Attribute VB_Name = "ApiClient"
Option Explicit

' ============================================================
' ChiroDX AI Server — VBA API Client  v2.0
' ============================================================
' Handles all HTTP communication with the local AI server
' and provides lightweight JSON parsing helpers.
'
' HOW TO USE:
'   1. Import this .bas file into your CorelDraw VBA project
'      (File > Import File in the VBA editor)
'   2. Import ToolsPanel.frm the same way
'   3. Run ShowToolsPanel to open the panel
' ============================================================

' ── Configuration ───────────────────────────────────────────
Public Const SERVER_URL     As String = "http://localhost:3000"
Public Const SERVER_TIMEOUT As Long   = 60000   ' ms (60 s — AI calls can be slow)
Public Const STARTUP_WAIT   As Integer = 20      ' half-second attempts to wait for server

' ── Server auto-start ───────────────────────────────────────

' Call this from the panel's Open event.
' serverDir: full path to the ai-server folder
' e.g. "C:\Users\Tuan\Documents\ChiroDX\corel-custom-tools\ai-server"
Public Sub EnsureServerRunning(ByVal serverDir As String)
    If IsServerRunning() Then Exit Sub

    Dim cmd As String
    cmd = "cmd /c cd /d """ & serverDir & """ && node server.js"
    Shell cmd, vbHide

    ' Poll until server responds (up to ~10 seconds)
    Dim i As Integer
    For i = 1 To STARTUP_WAIT
        Wait 500
        If IsServerRunning() Then Exit Sub
    Next i
End Sub

' Returns True if the server is reachable
Public Function IsServerRunning() As Boolean
    Dim resp As String
    resp = HttpGet("/health")
    IsServerRunning = (InStr(resp, """status"":""ok""") > 0 _
                    Or InStr(resp, """status"": ""ok""") > 0)
End Function

' ── HTTP helpers ────────────────────────────────────────────

Public Function HttpGet(ByVal endpoint As String) As String
    On Error GoTo fail
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "GET", SERVER_URL & endpoint, False
    http.setTimeouts 5000, 5000, SERVER_TIMEOUT, SERVER_TIMEOUT
    http.send
    HttpGet = http.responseText
    Exit Function
fail:
    HttpGet = ""
End Function

Public Function HttpPost(ByVal endpoint As String, ByVal jsonBody As String) As String
    On Error GoTo fail
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "POST", SERVER_URL & endpoint, False
    http.setTimeouts 5000, 5000, SERVER_TIMEOUT, SERVER_TIMEOUT
    http.setRequestHeader "Content-Type", "application/json"
    http.send jsonBody
    HttpPost = http.responseText
    Exit Function
fail:
    HttpPost = ""
End Function

' ── Tool call wrappers ───────────────────────────────────────

' Grammar check — returns raw JSON response string
Public Function CheckGrammar(ByVal text As String, _
                              Optional ByVal model As String = "gpt-4o-mini") As String
    Dim body As String
    body = "{""text"":""" & EscapeJson(text) & _
           """,""model"":""" & model & """}"
    CheckGrammar = HttpPost("/text/grammar", body)
End Function

' Completeness check — returns raw JSON response string
Public Function CheckCompleteness(ByVal text As String, _
                                   ByVal docType As String, _
                                   Optional ByVal model As String = "gpt-4o-mini") As String
    Dim body As String
    body = "{""text"":""" & EscapeJson(text) & _
           """,""documentType"":""" & docType & _
           """,""model"":""" & model & """}"
    CheckCompleteness = HttpPost("/text/completeness", body)
End Function

' Translation — returns raw JSON response string
Public Function TranslateText(ByVal text As String, _
                               ByVal targetLang As String, _
                               Optional ByVal model As String = "gpt-4o-mini") As String
    Dim body As String
    body = "{""text"":""" & EscapeJson(text) & _
           """,""targetLanguage"":""" & targetLang & _
           """,""model"":""" & model & """}"
    TranslateText = HttpPost("/text/translate", body)
End Function

' Price format check — returns raw JSON response string
Public Function CheckPriceFormat(ByVal text As String, _
                                  Optional ByVal model As String = "gpt-4o-mini") As String
    Dim body As String
    body = "{""text"":""" & EscapeJson(text) & _
           """,""model"":""" & model & """}"
    CheckPriceFormat = HttpPost("/text/price-format", body)
End Function

' Font pairing — returns raw JSON response string
Public Function GetFontPairing(ByVal headerFont As String, _
                                ByVal docType As String, _
                                Optional ByVal model As String = "gpt-4o-mini") As String
    Dim body As String
    body = "{""headerFont"":""" & EscapeJson(headerFont) & _
           """,""documentType"":""" & docType & _
           """,""model"":""" & model & """}"
    GetFontPairing = HttpPost("/text/font-pairing", body)
End Function

' Image generation — returns raw JSON response string
Public Function GenerateImage(ByVal prompt As String, _
                               Optional ByVal size As String = "1024x1024") As String
    Dim body As String
    body = "{""prompt"":""" & EscapeJson(prompt) & _
           """,""size"":""" & size & """}"
    GenerateImage = HttpPost("/image/generate", body)
End Function

' Color palette from image file
Public Function ExtractColorPalette(ByVal imagePath As String) As String
    Dim body As String
    body = "{""imagePath"":""" & EscapeJson(imagePath) & """}"
    ExtractColorPalette = HttpPost("/image/color-palette", body)
End Function

' Color palette from text description
Public Function GenerateColorPalette(ByVal description As String, _
                                      Optional ByVal model As String = "gpt-4o-mini") As String
    Dim body As String
    body = "{""description"":""" & EscapeJson(description) & _
           """,""model"":""" & model & """}"
    GenerateColorPalette = HttpPost("/image/color-palette-generate", body)
End Function

' ── JSON helpers ─────────────────────────────────────────────

' Extract a string value by key from a flat JSON object.
' JsonGetString("{""name"":""hello""}", "name") → "hello"
Public Function JsonGetString(ByVal json As String, ByVal key As String) As String
    Dim pos As Long, endPos As Long
    Dim patterns(1) As String
    patterns(0) = """" & key & """:"
    patterns(1) = """" & key & """: "

    Dim p As Integer
    For p = 0 To 1
        pos = InStr(json, patterns(p))
        If pos > 0 Then
            pos = pos + Len(patterns(p))
            ' Skip whitespace
            Do While Mid(json, pos, 1) = " ": pos = pos + 1: Loop
            ' String value?
            If Mid(json, pos, 1) = """" Then
                pos = pos + 1
                endPos = pos
                Do While endPos <= Len(json)
                    If Mid(json, endPos, 1) = """" And Mid(json, endPos - 1, 1) <> "\" Then Exit Do
                    endPos = endPos + 1
                Loop
                JsonGetString = UnescapeJson(Mid(json, pos, endPos - pos))
            Else
                ' Number / bool: read until delimiter
                endPos = pos
                Do While endPos <= Len(json)
                    Dim ch As String
                    ch = Mid(json, endPos, 1)
                    If ch = "," Or ch = "}" Or ch = "]" Or ch = vbLf Or ch = vbCr Then Exit Do
                    endPos = endPos + 1
                Loop
                JsonGetString = Trim(Mid(json, pos, endPos - pos))
            End If
            Exit Function
        End If
    Next p
    JsonGetString = ""
End Function

Public Function JsonGetLong(ByVal json As String, ByVal key As String) As Long
    Dim v As String
    v = JsonGetString(json, key)
    If IsNumeric(v) Then JsonGetLong = CLng(v) Else JsonGetLong = 0
End Function

Public Function JsonGetBool(ByVal json As String, ByVal key As String) As Boolean
    JsonGetBool = (LCase(JsonGetString(json, key)) = "true")
End Function

' Extract a JSON array (as raw string) by key.
' JsonGetArray("{""items"":[""a"",""b""]}", "items") → "[""a"",""b""]"
Public Function JsonGetArray(ByVal json As String, ByVal key As String) As String
    Dim pos As Long, depth As Integer
    Dim inStr As Boolean
    Dim patterns(1) As String
    patterns(0) = """" & key & """:["
    patterns(1) = """" & key & """: ["

    Dim p As Integer
    For p = 0 To 1
        pos = InStr(json, patterns(p))
        If pos > 0 Then
            pos = pos + Len(patterns(p)) - 1   ' points to "["
            Dim startPos As Long: startPos = pos
            depth = 0: inStr = False
            Do While pos <= Len(json)
                Dim c As String: c = Mid(json, pos, 1)
                If c = """" And Not inStr Then
                    inStr = True
                ElseIf c = """" And inStr And Mid(json, pos - 1, 1) <> "\" Then
                    inStr = False
                ElseIf Not inStr Then
                    If c = "[" Then depth = depth + 1
                    If c = "]" Then
                        depth = depth - 1
                        If depth = 0 Then
                            JsonGetArray = Mid(json, startPos, pos - startPos + 1)
                            Exit Function
                        End If
                    End If
                End If
                pos = pos + 1
            Loop
        End If
    Next p
    JsonGetArray = "[]"
End Function

' Split a JSON string array into a VBA String array.
' JsonSplitArray("[""a"",""b"",""c""]") → ("a", "b", "c")
Public Function JsonSplitArray(ByVal jsonArr As String) As String()
    Dim result() As String
    jsonArr = Trim(jsonArr)
    If Left(jsonArr, 1) = "[" Then jsonArr = Mid(jsonArr, 2)
    If Right(jsonArr, 1) = "]" Then jsonArr = Left(jsonArr, Len(jsonArr) - 1)
    jsonArr = Trim(jsonArr)

    If Len(jsonArr) = 0 Then
        ReDim result(0): result(0) = "": JsonSplitArray = result: Exit Function
    End If

    ' Count quoted items
    Dim count As Integer: count = 0
    Dim i As Long: i = 1
    Do While i <= Len(jsonArr)
        If Mid(jsonArr, i, 1) = """" Then
            count = count + 1
            i = i + 1
            Do While i <= Len(jsonArr)
                If Mid(jsonArr, i, 1) = """" And Mid(jsonArr, i - 1, 1) <> "\" Then Exit Do
                i = i + 1
            Loop
        End If
        i = i + 1
    Loop

    If count = 0 Then
        ReDim result(0): result(0) = "": JsonSplitArray = result: Exit Function
    End If

    ReDim result(count - 1)
    Dim idx As Integer: idx = 0
    i = 1
    Do While i <= Len(jsonArr) And idx < count
        If Mid(jsonArr, i, 1) = """" Then
            i = i + 1
            Dim endPos As Long: endPos = i
            Do While endPos <= Len(jsonArr)
                If Mid(jsonArr, endPos, 1) = """" And Mid(jsonArr, endPos - 1, 1) <> "\" Then Exit Do
                endPos = endPos + 1
            Loop
            result(idx) = UnescapeJson(Mid(jsonArr, i, endPos - i))
            idx = idx + 1
            i = endPos + 1
        Else
            i = i + 1
        End If
    Loop

    JsonSplitArray = result
End Function

' ── JSON objects array helpers ────────────────────────────────

' Split a JSON array of objects into individual object strings.
' Use before calling JsonGetString on each object.
Public Function JsonSplitObjects(ByVal jsonArr As String) As String()
    Dim result() As String
    ReDim result(0)
    result(0) = ""

    jsonArr = Trim(jsonArr)
    If Left(jsonArr, 1) = "[" Then jsonArr = Mid(jsonArr, 2)
    If Right(jsonArr, 1) = "]" Then jsonArr = Left(jsonArr, Len(jsonArr) - 1)
    jsonArr = Trim(jsonArr)

    If Len(jsonArr) = 0 Then
        JsonSplitObjects = result: Exit Function
    End If

    ' Count objects
    Dim count As Integer: count = 0
    Dim depth As Integer: depth = 0
    Dim inStr As Boolean: inStr = False
    Dim i As Long

    For i = 1 To Len(jsonArr)
        Dim c As String: c = Mid(jsonArr, i, 1)
        If c = """" And Not inStr Then
            inStr = True
        ElseIf c = """" And inStr And Mid(jsonArr, i - 1, 1) <> "\" Then
            inStr = False
        ElseIf Not inStr Then
            If c = "{" Then
                depth = depth + 1
                If depth = 1 Then count = count + 1
            ElseIf c = "}" Then
                depth = depth - 1
            End If
        End If
    Next i

    If count = 0 Then JsonSplitObjects = result: Exit Function

    ReDim result(count - 1)
    Dim idx As Integer: idx = 0
    Dim startPos As Long: startPos = 0
    depth = 0: inStr = False

    For i = 1 To Len(jsonArr)
        c = Mid(jsonArr, i, 1)
        If c = """" And Not inStr Then
            inStr = True
        ElseIf c = """" And inStr And Mid(jsonArr, i - 1, 1) <> "\" Then
            inStr = False
        ElseIf Not inStr Then
            If c = "{" Then
                depth = depth + 1
                If depth = 1 Then startPos = i
            ElseIf c = "}" Then
                depth = depth - 1
                If depth = 0 And startPos > 0 And idx < count Then
                    result(idx) = Mid(jsonArr, startPos, i - startPos + 1)
                    idx = idx + 1
                    startPos = 0
                End If
            End If
        End If
    Next i

    JsonSplitObjects = result
End Function

' ── String helpers ────────────────────────────────────────────

' Escape a string for embedding in a JSON value
Public Function EscapeJson(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    s = Replace(s, Chr(13), "\r")
    s = Replace(s, Chr(10), "\n")
    s = Replace(s, Chr(9), "\t")
    EscapeJson = s
End Function

' Unescape a JSON string value
Public Function UnescapeJson(ByVal s As String) As String
    s = Replace(s, "\n", vbNewLine)
    s = Replace(s, "\r", "")
    s = Replace(s, "\t", vbTab)
    s = Replace(s, "\""", """")
    s = Replace(s, "\\", "\")
    UnescapeJson = s
End Function

' ── CorelDraw canvas helpers ──────────────────────────────────

' Get all text from all text frames on the current page
Public Function GetAllPageText() As String
    Dim result As String
    Dim sh As Shape
    On Error Resume Next
    For Each sh In ActivePage.Shapes
        If sh.Type = cdrTextShape Then
            result = result & sh.Text.Story.Text & vbNewLine
        End If
    Next sh
    On Error GoTo 0
    GetAllPageText = Trim(result)
End Function

' Get text from the currently selected text frame (empty string if none selected)
Public Function GetSelectedText() As String
    On Error GoTo noSel
    Dim sel As Shape
    Set sel = ActiveSelection
    If sel Is Nothing Then GoTo noSel
    If sel.Type <> cdrTextShape Then GoTo noSel
    GetSelectedText = sel.Text.Story.Text
    Exit Function
noSel:
    GetSelectedText = ""
End Function

' Find and replace text in the selected text frame, preserving character formatting
Public Sub ApplyTextFix(ByVal originalText As String, ByVal newText As String)
    On Error GoTo fail
    Dim sel As Shape
    Set sel = ActiveSelection
    If sel Is Nothing Then Exit Sub
    If sel.Type <> cdrTextShape Then Exit Sub

    Dim story As TextRange
    Set story = sel.Text.Story
    Dim pos As Long
    pos = InStr(story.Text, originalText)
    If pos > 0 Then
        Dim rng As TextRange
        Set rng = story.Characters(pos, Len(originalText))
        rng.Text = newText
    End If
    Exit Sub
fail:
    MsgBox "Could not apply fix: " & Err.Description, vbExclamation
End Sub

' Import a PNG from disk and center it on the current page
Public Sub PlaceImageOnCanvas(ByVal filePath As String)
    On Error GoTo fail
    If Dir(filePath) = "" Then
        MsgBox "Image file not found: " & filePath, vbExclamation
        Exit Sub
    End If
    Dim imp As ImportFilter
    Set imp = ActiveDocument.ActiveLayer.Import(filePath)
    imp.Finish
    ' Center on page
    Dim s As Shape: Set s = ActiveSelection
    If Not s Is Nothing Then
        s.SetPosition ActivePage.SizeWidth / 2, ActivePage.SizeHeight / 2
    End If
    Exit Sub
fail:
    MsgBox "Could not place image: " & Err.Description, vbExclamation
End Sub

' ── Utility ───────────────────────────────────────────────────

' Non-blocking wait (milliseconds)
Private Sub Wait(ByVal ms As Long)
    Dim endTime As Date
    endTime = Now() + ms / 86400000
    Do While Now() < endTime
        DoEvents
    Loop
End Sub

' Open the ToolsPanel (call this from a toolbar button or macro)
Public Sub ShowToolsPanel()
    ToolsPanel.Show vbModeless
End Sub
