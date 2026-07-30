Attribute VB_Name = "ShapeDeserializer"
Option Explicit

' ============================================================
' ChiroDX  --  ShapeDeserializer  v1.0
' ============================================================
' Fetches the processed result from /corel/result/:sessionId
' and applies text changes back to the original CorelDraw shapes.
'
' REQUIRES: ApiClient.bas  (JSON helpers, HttpGet, HttpPostUtf8)
'           ShapeSerializer.bas  (GetLastSessionId)
'
' USAGE (called from ToolsPanel "Apply from AI" button):
'   ApplyResultFromServer
' ============================================================

' ── Public entry point ────────────────────────────────────────

' Fetches the latest result and applies it to CorelDraw.
Public Sub ApplyResultFromServer()
    On Error GoTo fail

    Dim sessionId As String
    sessionId = GetLastSessionId()

    If Len(sessionId) = 0 Then
        MsgBox "No active session. Use 'Send Selection' first.", vbInformation, "ChiroDX"
        Exit Sub
    End If

    ' Fetch result from server
    Dim resp As String
    resp = HttpGet("/corel/result/" & sessionId)

    If Len(resp) = 0 Then
        MsgBox "Could not reach server.", vbExclamation, "ChiroDX"
        Exit Sub
    End If

    ' Check status
    Dim status As String
    status = JsonGetString(resp, "status")

    Select Case status
        Case "ready"
            ' Good — proceed
        Case "pending"
            MsgBox "The AI app hasn't finished yet. Check the ChiroDX panel.", vbInformation, "ChiroDX"
            Exit Sub
        Case "applied"
            MsgBox "This result has already been applied.", vbInformation, "ChiroDX"
            Exit Sub
        Case "cancelled"
            MsgBox "The session was cancelled in the AI app.", vbInformation, "ChiroDX"
            Exit Sub
        Case ""
            MsgBox "No result found for session " & sessionId & "." & vbCrLf & _
                   "The session may have expired (30 min limit).", vbExclamation, "ChiroDX"
            Exit Sub
    End Select

    ' Parse shapes array and apply
    Dim shapesJson As String
    shapesJson = JsonGetArray(resp, "shapes")

    If shapesJson = "[]" Or Len(shapesJson) = 0 Then
        MsgBox "No changes were returned by the AI app.", vbInformation, "ChiroDX"
        Exit Sub
    End If

    Dim shapeItems() As String
    shapeItems = JsonSplitObjects(shapesJson)

    ' Wrap all changes in a single undo group
    On Error Resume Next
    ActiveDocument.BeginCommandGroup "ChiroDX: Apply AI Result"
    On Error GoTo 0

    Dim applied As Integer
    Dim skipped As Integer
    applied = 0
    skipped = 0

    Dim i As Integer
    For i = 0 To UBound(shapeItems)
        If Len(Trim(shapeItems(i))) > 2 Then
            Dim ok As Boolean
            ok = ApplySingleShape(shapeItems(i))
            If ok Then applied = applied + 1 Else skipped = skipped + 1
        End If
    Next i

    On Error Resume Next
    ActiveDocument.EndCommandGroup
    On Error GoTo 0

    ' Tell server the result was applied
    HttpPostUtf8 "/corel/result/" & sessionId & "/applied", "{""sessionId"":""" & sessionId & """}"

    ' Report
    Dim msg As String
    msg = "Applied " & applied & " shape(s)."
    If skipped > 0 Then msg = msg & vbCrLf & skipped & " shape(s) skipped (deleted or not found)."
    MsgBox msg, vbInformation, "ChiroDX"
    Exit Sub

fail:
    On Error Resume Next
    ActiveDocument.EndCommandGroup
    On Error GoTo 0
    MsgBox "Error applying result: " & Err.Description, vbExclamation, "ChiroDX"
End Sub

' ── Single shape apply ────────────────────────────────────────

Private Function ApplySingleShape(shapeJson As String) As Boolean
    ApplySingleShape = False
    On Error GoTo shapeFail

    Dim shapeId As String
    shapeId = JsonGetString(shapeJson, "shapeId")

    If Len(shapeId) = 0 Then Exit Function

    ' Find the shape by its tagged name
    Dim target As Shape
    Set target = FindShapeByName(shapeId)

    If target Is Nothing Then
        ' Shape was deleted — skip silently
        Exit Function
    End If

    ' Only apply to text shapes
    If target.Type <> cdrTextShape Then
        ' Unlock non-text shapes (group children etc.) and skip
        target.Locked = False
        ApplySingleShape = True
        Exit Function
    End If

    ' Parse paragraphs from the result
    Dim paragraphsJson As String
    paragraphsJson = JsonGetArray(shapeJson, "paragraphs")

    If paragraphsJson = "[]" Or Len(paragraphsJson) = 0 Then
        ' No text changes — just unlock
        target.Locked = False
        ' Restore original name
        Dim origName As String
        origName = JsonGetString(shapeJson, "originalName")
        If Len(origName) > 0 Then target.Name = origName
        ApplySingleShape = True
        Exit Function
    End If

    ' Apply text changes
    ApplyTextToShape target, shapeJson, paragraphsJson

    ' Unlock and restore original name
    target.Locked = False
    origName = JsonGetString(shapeJson, "originalName")
    If Len(origName) > 0 Then target.Name = origName

    ApplySingleShape = True
    Exit Function

shapeFail:
    ApplySingleShape = False
End Function

' ── Text application ──────────────────────────────────────────

Private Sub ApplyTextToShape(s As Shape, shapeJson As String, paragraphsJson As String)
    On Error GoTo fail

    Dim paraItems() As String
    paraItems = JsonSplitObjects(paragraphsJson)

    ' Step 1: Build the complete plain text string from all runs
    ' We need this to set Story.Text first (which clears formatting)
    Dim fullText As String
    fullText = ""

    Dim p As Integer
    For p = 0 To UBound(paraItems)
        If Len(Trim(paraItems(p))) <= 2 Then GoTo nextParaText
        If p > 0 Then fullText = fullText & Chr(13)

        Dim runsJsonTxt As String
        runsJsonTxt = JsonGetArray(paraItems(p), "runs")
        Dim runItemsTxt() As String
        runItemsTxt = JsonSplitObjects(runsJsonTxt)

        Dim r As Integer
        For r = 0 To UBound(runItemsTxt)
            If Len(Trim(runItemsTxt(r))) > 2 Then
                fullText = fullText & JsonGetString(runItemsTxt(r), "text")
            End If
        Next r
nextParaText:
    Next p

    ' Step 2: Set the plain text (this resets ALL formatting to the shape default)
    s.Text.Story.Text = fullText

    ' Step 3: Re-apply formatting run by run
    Dim charPos As Long
    charPos = 1

    For p = 0 To UBound(paraItems)
        If Len(Trim(paraItems(p))) <= 2 Then GoTo nextParaApply

        ' Apply paragraph alignment
        Dim alignStr As String
        alignStr = JsonGetString(paraItems(p), "alignment")

        Dim runsJson As String
        runsJson = JsonGetArray(paraItems(p), "runs")
        Dim runItems() As String
        runItems = JsonSplitObjects(runsJson)

        ' Get paragraph text length from runs
        Dim paraLen As Long
        paraLen = 0
        Dim rr As Integer
        For rr = 0 To UBound(runItems)
            If Len(Trim(runItems(rr))) > 2 Then
                paraLen = paraLen + Len(JsonGetString(runItems(rr), "text"))
            End If
        Next rr

        ' Apply alignment to the paragraph range
        If paraLen > 0 Then
            On Error Resume Next
            Dim paraRange As TextRange
            Set paraRange = s.Text.Story.Characters(charPos, paraLen)
            paraRange.Alignment = GetAlignmentConst(alignStr)
            On Error GoTo 0
        End If

        ' Apply each run's formatting
        Dim runCharPos As Long
        runCharPos = charPos

        For rr = 0 To UBound(runItems)
            If Len(Trim(runItems(rr))) <= 2 Then GoTo nextRun

            Dim runText As String
            runText = JsonGetString(runItems(rr), "text")
            Dim runLen As Long
            runLen = Len(runText)
            If runLen = 0 Then GoTo nextRun

            On Error Resume Next
            Dim runRange As TextRange
            Set runRange = s.Text.Story.Characters(runCharPos, runLen)

            ' Apply font formatting
            Dim fontName As String
            fontName = JsonGetString(runItems(rr), "font")
            If Len(fontName) > 0 Then runRange.Font = fontName

            Dim sizePt As Double
            Dim sizeStr As String
            sizeStr = JsonGetString(runItems(rr), "sizePt")
            If IsNumeric(sizeStr) Then
                sizePt = CDbl(sizeStr)
                If sizePt > 0 Then runRange.Size = sizePt
            End If

            runRange.Bold   = (LCase(JsonGetString(runItems(rr), "bold")) = "true")
            runRange.Italic = (LCase(JsonGetString(runItems(rr), "italic")) = "true")

            Dim underlineVal As Boolean
            underlineVal = (LCase(JsonGetString(runItems(rr), "underline")) = "true")
            If underlineVal Then
                runRange.Underline = cdrSingleUnderline
            Else
                runRange.Underline = cdrNoUnderline
            End If

            ' Apply color from colorRGB array
            Dim colorArr As String
            colorArr = JsonGetArray(runItems(rr), "colorRGB")
            If colorArr <> "[]" And Len(colorArr) > 2 Then
                Dim rgb() As String
                rgb = JsonSplitArray(colorArr)
                If UBound(rgb) >= 2 Then
                    If IsNumeric(rgb(0)) And IsNumeric(rgb(1)) And IsNumeric(rgb(2)) Then
                        Dim col As New Color
                        col.RGBAssign CLng(rgb(0)), CLng(rgb(1)), CLng(rgb(2))
                        runRange.Fill.UniformColor = col
                    End If
                End If
            End If
            On Error GoTo 0

            runCharPos = runCharPos + runLen
nextRun:
        Next rr

        ' Advance past paragraph text + separator Chr(13)
        charPos = charPos + paraLen + 1
nextParaApply:
    Next p

    Exit Sub
fail:
    ' Non-fatal: formatting may be partially applied
End Sub

' ── Helpers ───────────────────────────────────────────────────

' Find a shape anywhere in the active document by its Name property.
' Searches all layers and all pages.
Private Function FindShapeByName(nameToFind As String) As Shape
    Set FindShapeByName = Nothing
    On Error Resume Next
    Dim pg As Page
    For Each pg In ActiveDocument.Pages
        Dim lyr As Layer
        For Each lyr In pg.Layers
            Dim s As Shape
            For Each s In lyr.Shapes
                If s.Name = nameToFind Then
                    Set FindShapeByName = s
                    Exit Function
                End If
                ' Also search inside groups
                If s.Type = cdrGroupShape Then
                    Dim found As Shape
                    Set found = FindInGroup(s, nameToFind)
                    If Not found Is Nothing Then
                        Set FindShapeByName = found
                        Exit Function
                    End If
                End If
            Next s
        Next lyr
    Next pg
    On Error GoTo 0
End Function

Private Function FindInGroup(grp As Shape, nameToFind As String) As Shape
    Set FindInGroup = Nothing
    Dim i As Long
    For i = 1 To grp.Shapes.Count
        If grp.Shapes(i).Name = nameToFind Then
            Set FindInGroup = grp.Shapes(i)
            Exit Function
        End If
        If grp.Shapes(i).Type = cdrGroupShape Then
            Dim found As Shape
            Set found = FindInGroup(grp.Shapes(i), nameToFind)
            If Not found Is Nothing Then
                Set FindInGroup = found
                Exit Function
            End If
        End If
    Next i
End Function

Private Function GetAlignmentConst(alignStr As String) As Long
    Select Case alignStr
        Case "Left":    GetAlignmentConst = 1
        Case "Center":  GetAlignmentConst = 2
        Case "Right":   GetAlignmentConst = 3
        Case "Justify": GetAlignmentConst = 4
        Case "None":    GetAlignmentConst = 5
        Case Else:      GetAlignmentConst = 1
    End Select
End Function
