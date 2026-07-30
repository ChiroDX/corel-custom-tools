Attribute VB_Name = "ShapeSerializer"
Option Explicit

' ============================================================
' ChiroDX  --  ShapeSerializer  v1.1
' ============================================================
' Serializes the current CorelDraw selection into the
' ChiroDX Shape Exchange Format (see specs/shape-format.ts).
'
' REQUIRES: ApiClient.bas (for EscapeJson, SERVER_URL, HttpPostUtf8)
' ============================================================

' Module-level session tracking
Private m_LastSessionId As String

' ── Public entry point ────────────────────────────────────────

Public Function SendSelectionToServer() As String
    On Error GoTo fail

    ' ── Get the active selection ──────────────────────────────
    ' Use ActiveSelection As Shape, just like the rest of the VBA codebase.
    ' Do NOT call .Shapes here — that only works for groups, not single shapes.
    Dim selShape As Shape
    On Error Resume Next
    Set selShape = ActiveSelection
    On Error GoTo fail

    ' Separate If checks — VBA does NOT short-circuit Or
    If selShape Is Nothing Then
        MsgBox "Please select one or more objects first.", vbInformation, "ChiroDX"
        SendSelectionToServer = ""
        Exit Function
    End If

    ' ── Generate session ID ───────────────────────────────────
    Dim sessionId As String
    sessionId = "s" & Format(Now(), "yyyymmddHHmmss") & _
                Format(Int(Rnd() * 9000) + 1000, "0000")

    ' ── Serialize ─────────────────────────────────────────────
    Dim json As String
    json = BuildEnvelope(selShape, sessionId)

    ' ── Tag shapes so we can find them on Apply ───────────────
    TagShapes selShape, sessionId

    ' ── POST to server ────────────────────────────────────────
    Dim resp As String
    resp = HttpPostUtf8("/corel/push", json)

    If Len(resp) = 0 Then
        UntagShapes selShape
        MsgBox "Could not reach server. Is ChiroDX running?", vbExclamation, "ChiroDX"
        SendSelectionToServer = ""
        Exit Function
    End If

    m_LastSessionId = sessionId
    SendSelectionToServer = sessionId
    Exit Function

fail:
    SendSelectionToServer = ""
    If Err.Number <> 0 Then
        MsgBox "Serialization error: " & Err.Description, vbExclamation, "ChiroDX"
    End If
End Function

Public Function GetLastSessionId() As String
    GetLastSessionId = m_LastSessionId
End Function

' ── JSON envelope ─────────────────────────────────────────────
' Takes the selection Shape (may be a single shape OR a temp group
' when multiple shapes are selected).

Private Function BuildEnvelope(selShape As Shape, sessionId As String) As String
    Dim docName As String: docName = ""
    Dim pageNum As Long:   pageNum = 1
    On Error Resume Next
    docName = ActiveDocument.Name
    pageNum  = ActivePage.Index
    On Error GoTo 0

    ' ── Build shapes array ────────────────────────────────────
    ' When multiple shapes are selected CorelDraw wraps them in a
    ' temporary group, so selShape.Type = cdrGroupShape.
    ' When one shape is selected, selShape IS that shape.
    Dim shapesJson As String
    shapesJson = "["

    If selShape.Type = cdrGroupShape Then
        Dim i As Long
        For i = 1 To selShape.Shapes.Count
            If i > 1 Then shapesJson = shapesJson & ","
            shapesJson = shapesJson & SerializeShape(selShape.Shapes(i), i - 1, sessionId)
        Next i
    Else
        shapesJson = shapesJson & SerializeShape(selShape, 0, sessionId)
    End If

    shapesJson = shapesJson & "]"

    Dim env As String
    env = "{"
    env = env & """sessionId"":""" & sessionId & """"
    env = env & ",""documentName"":""" & EscapeJson(docName) & """"
    env = env & ",""pageNumber"":" & pageNum
    env = env & ",""sentAt"":""" & Format(Now(), "yyyy-mm-ddThh:nn:ss") & """"
    env = env & ",""shapes"":" & shapesJson
    env = env & "}"
    BuildEnvelope = env
End Function

' ── Shape serializer ──────────────────────────────────────────

Private Function SerializeShape(s As Shape, idx As Long, sessionId As String) As String
    Dim shapeType  As String: shapeType  = GetShapeTypeName(s)
    Dim layerName  As String: layerName  = ""
    Dim origName   As String: origName   = ""

    On Error Resume Next
    layerName = s.Layer.Name
    origName  = s.Name
    On Error GoTo 0

    Dim res As String
    res = "{"
    res = res & """shapeId"":""CHIRODX_" & sessionId & "_" & idx & """"
    res = res & ",""originalName"":""" & EscapeJson(origName) & """"
    res = res & ",""index"":" & idx
    res = res & ",""shapeType"":""" & shapeType & """"
    res = res & ",""layer"":""" & EscapeJson(layerName) & """"
    res = res & ",""bounds"":" & BuildBoundsJson(s)

    If s.Type = cdrTextShape Then
        res = res & ",""paragraphs"":" & SerializeParagraphs(s)
    Else
        res = res & ",""paragraphs"":[]"
    End If

    If s.Type = cdrGroupShape Then
        res = res & ",""children"":" & SerializeChildren(s, idx, sessionId)
    End If

    res = res & "}"
    SerializeShape = res
End Function

Private Function GetShapeTypeName(s As Shape) As String
    Select Case s.Type
        Case cdrTextShape:   GetShapeTypeName = "TextFrame"
        Case cdrGroupShape:  GetShapeTypeName = "Group"
        Case cdrBitmapShape: GetShapeTypeName = "Other"
        Case Else:           GetShapeTypeName = "Other"
    End Select
    If s.Type = cdrTextShape Then
        On Error Resume Next
        If s.Text.IsArtisticText Then GetShapeTypeName = "ArtisticText"
        On Error GoTo 0
    End If
End Function

Private Function BuildBoundsJson(s As Shape) As String
    Dim x As Double, y As Double, w As Double, h As Double
    On Error Resume Next
    x = s.LeftX: y = s.BottomY: w = s.SizeWidth: h = s.SizeHeight
    On Error GoTo 0
    BuildBoundsJson = "{""x"":" & FormatNum(x) & ",""y"":" & FormatNum(y) & _
                      ",""w"":" & FormatNum(w) & ",""h"":" & FormatNum(h) & _
                      ",""unit"":""mm""}"
End Function

' ── Paragraph & run serializer ────────────────────────────────

Private Function SerializeParagraphs(s As Shape) As String
    On Error GoTo errHandler

    Dim story As TextRange
    Set story = s.Text.Story

    Dim fullText As String
    fullText = story.Text
    If Len(fullText) = 0 Then
        SerializeParagraphs = "[]"
        Exit Function
    End If

    Dim paraTexts() As String
    paraTexts = Split(fullText, Chr(13))

    Dim result As String: result = "["
    Dim charPos As Long:  charPos = 1
    Dim firstPara As Boolean: firstPara = True

    Dim p As Integer
    For p = 0 To UBound(paraTexts)
        Dim paraText As String
        paraText = paraTexts(p)
        ' Skip the empty trailing paragraph CorelDraw always appends
        If p = UBound(paraTexts) And Len(paraText) = 0 Then GoTo nextPara

        If Not firstPara Then result = result & ","
        firstPara = False

        ' Paragraph alignment — read from first character of this paragraph
        Dim alignment As String: alignment = "Left"
        If Len(paraText) > 0 And charPos <= Len(fullText) Then
            On Error Resume Next
            Dim paraChar As TextRange
            Set paraChar = story.Characters(charPos, 1)
            If Not paraChar Is Nothing Then
                alignment = GetAlignmentName(paraChar.Alignment)
            End If
            Set paraChar = Nothing
            On Error GoTo 0
        End If

        Dim runsJson As String
        If Len(paraText) > 0 Then
            runsJson = SerializeRuns(story, charPos, Len(paraText))
        Else
            runsJson = "[]"
        End If

        result = result & "{" & _
                 """alignment"":""" & alignment & """" & _
                 ",""spaceBefore"":0" & _
                 ",""spaceAfter"":0" & _
                 ",""runs"":" & runsJson & "}"

        charPos = charPos + Len(paraText) + 1  ' +1 for the Chr(13)
nextPara:
    Next p

    result = result & "]"
    SerializeParagraphs = result
    Exit Function

errHandler:
    SerializeParagraphs = "[]"
End Function

Private Function SerializeRuns(story As TextRange, startPos As Long, paraLen As Long) As String
    If paraLen = 0 Then
        SerializeRuns = "[]"
        Exit Function
    End If

    Dim result As String:  result = "["
    Dim runText As String: runText = ""
    Dim firstRun As Boolean: firstRun = True

    ' Run state
    Dim runFont As String:   runFont = ""
    Dim runSize As Double:   runSize = 0
    Dim runBold As Boolean:  runBold = False
    Dim runItal As Boolean:  runItal = False
    Dim runUnder As Boolean: runUnder = False
    Dim runR As Long: runR = 0
    Dim runG As Long: runG = 0
    Dim runB As Long: runB = 0

    Dim i As Long
    For i = 0 To paraLen - 1
        Dim curPos As Long
        curPos = startPos + i

        ' ── Read character properties ─────────────────────────
        ' Keep On Error Resume Next active for the ENTIRE character
        ' block so no individual property access can escape as an error.
        On Error Resume Next

        Dim ch As TextRange
        Set ch = story.Characters(curPos, 1)

        ' If we couldn't get the character, skip it
        If Err.Number <> 0 Or ch Is Nothing Then
            Err.Clear
            Set ch = Nothing
            On Error GoTo 0
            GoTo nextChar
        End If
        Err.Clear

        Dim cFont  As String:  cFont  = ch.Font
        Dim cSize  As Double:  cSize  = ch.Size
        Dim cBold  As Boolean: cBold  = ch.Bold
        Dim cItal  As Boolean: cItal  = ch.Italic

        ' Underline: 0 = none.  Use numeric literal to avoid constant-name issues.
        Dim cUnder As Boolean: cUnder = (ch.Underline <> 0)

        ' Color — text fill may not always be a uniform color (e.g. no fill),
        ' so default to black and only overwrite on success.
        Dim cR As Long: cR = 0
        Dim cG As Long: cG = 0
        Dim cB As Long: cB = 0
        Dim tmpColor As Long
        tmpColor = ch.Fill.UniformColor.RGBRed:   If Err.Number = 0 Then cR = tmpColor Else Err.Clear
        tmpColor = ch.Fill.UniformColor.RGBGreen: If Err.Number = 0 Then cG = tmpColor Else Err.Clear
        tmpColor = ch.Fill.UniformColor.RGBBlue:  If Err.Number = 0 Then cB = tmpColor Else Err.Clear

        Dim chText As String: chText = ch.Text
        If Err.Number <> 0 Then Err.Clear: chText = ""

        ' Restore normal error handling before logic
        On Error GoTo 0
        Set ch = Nothing

        ' ── Detect run boundary ───────────────────────────────
        Dim formatChanged As Boolean
        If Len(runText) = 0 Then
            ' First character — initialise run state, no flush needed
            formatChanged = False
            runFont = cFont: runSize = cSize
            runBold = cBold: runItal = cItal: runUnder = cUnder
            runR = cR: runG = cG: runB = cB
        Else
            formatChanged = (cFont <> runFont) Or (cSize <> runSize) Or _
                            (cBold <> runBold) Or (cItal <> runItal) Or _
                            (cUnder <> runUnder) Or _
                            (cR <> runR) Or (cG <> runG) Or (cB <> runB)
        End If

        If formatChanged Then
            ' Flush accumulated run
            If Not firstRun Then result = result & ","
            firstRun = False
            result = result & BuildRunJson(runText, runFont, runSize, runBold, runItal, runUnder, runR, runG, runB)
            ' Start fresh run
            runText = chText
            runFont = cFont: runSize = cSize
            runBold = cBold: runItal = cItal: runUnder = cUnder
            runR = cR: runG = cG: runB = cB
        Else
            runText = runText & chText
        End If
nextChar:
    Next i

    ' Flush the final run
    If Len(runText) > 0 Then
        If Not firstRun Then result = result & ","
        result = result & BuildRunJson(runText, runFont, runSize, runBold, runItal, runUnder, runR, runG, runB)
    End If

    result = result & "]"
    SerializeRuns = result
End Function

Private Function BuildRunJson(txt As String, font As String, sizePt As Double, _
                               bold As Boolean, italic As Boolean, underline As Boolean, _
                               r As Long, g As Long, b As Long) As String
    BuildRunJson = "{" & _
                   """text"":"     & """" & EscapeJson(txt)  & """" & _
                   ",""font"":"    & """" & EscapeJson(font) & """" & _
                   ",""sizePt"":"  & FormatNum(sizePt) & _
                   ",""bold"":"    & LCase(CStr(bold)) & _
                   ",""italic"":"  & LCase(CStr(italic)) & _
                   ",""underline"":" & LCase(CStr(underline)) & _
                   ",""colorRGB"":[" & r & "," & g & "," & b & "]" & _
                   "}"
End Function

' ── Group children ────────────────────────────────────────────

Private Function SerializeChildren(grp As Shape, parentIdx As Long, sessionId As String) As String
    Dim result As String: result = "["
    Dim i As Long
    For i = 1 To grp.Shapes.Count
        If i > 1 Then result = result & ","
        result = result & SerializeShape(grp.Shapes(i), parentIdx * 100 + i, sessionId)
    Next i
    result = result & "]"
    SerializeChildren = result
End Function

' ── Shape tagging ─────────────────────────────────────────────
' Tags shapes with a session-scoped name and locks them so the user
' can't accidentally edit them while the AI app is processing.

Private Sub TagShapes(selShape As Shape, sessionId As String)
    On Error Resume Next
    If selShape.Type = cdrGroupShape Then
        Dim i As Long
        For i = 1 To selShape.Shapes.Count
            selShape.Shapes(i).Name   = "CHIRODX_" & sessionId & "_" & (i - 1)
            selShape.Shapes(i).Locked = True
        Next i
    Else
        selShape.Name   = "CHIRODX_" & sessionId & "_0"
        selShape.Locked = True
    End If
    On Error GoTo 0
End Sub

Public Sub UntagShapes(selShape As Shape)
    ' Called when send fails — just unlock, don't rename
    On Error Resume Next
    If selShape.Type = cdrGroupShape Then
        Dim i As Long
        For i = 1 To selShape.Shapes.Count
            selShape.Shapes(i).Locked = False
        Next i
    Else
        selShape.Locked = False
    End If
    On Error GoTo 0
End Sub

' ── Helpers ───────────────────────────────────────────────────

Private Function FormatNum(v As Double) As String
    ' JSON requires English decimal separator
    FormatNum = Replace(Format(v, "0.####"), ",", ".")
End Function

Private Function GetAlignmentName(alignConst As Long) As String
    Select Case alignConst
        Case 1:    GetAlignmentName = "Left"
        Case 2:    GetAlignmentName = "Center"
        Case 3:    GetAlignmentName = "Right"
        Case 4:    GetAlignmentName = "Justify"
        Case 5:    GetAlignmentName = "None"
        Case Else: GetAlignmentName = "Left"
    End Select
End Function
