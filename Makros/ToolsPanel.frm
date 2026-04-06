VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} ToolsPanel
   Caption         =   "ChiroDX Tools"
   ClientHeight    =   9720
   ClientLeft      =   30
   ClientTop       =   370
   ClientWidth     =   3960
   StartUpPosition =   0  'Manual

   Begin {978C9E23-D4B0-11CE-BF2D-00AA003F40D0} lblStatus
      Caption      =   "  Checking server..."
      ForeColor    =   &H00808080&
      Height       =   300
      Left         =   60
      TabIndex     =   0
      Top          =   60
      Width        =   3840
   End

   ' ── TEXT TOOLS ───────────────────────────────────────────
   Begin {6E182020-7FEC-11CE-9BD9-0000E202599C} fraText
      Caption      =   "Text Tools"
      Height       =   3000
      Left         =   60
      TabIndex     =   1
      Top          =   420
      Width        =   3840

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnGrammar
         Caption   =   "Grammar Check"
         Height    =   390
         Left      =   120
         TabIndex  =   2
         Top       =   180
         Width     =   3600
      End

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnPriceFormat
         Caption   =   "Price Format Check"
         Height    =   390
         Left      =   120
         TabIndex  =   3
         Top       =   630
         Width     =   3600
      End

      Begin {978C9E23-D4B0-11CE-BF2D-00AA003F40D0} lblDocType
         Caption   =   "Doc type:"
         Height    =   240
         Left      =   120
         TabIndex  =   4
         Top       =   1110
         Width     =   840
      End

      Begin {8BD21D30-EC42-11CE-9E0D-00AA006002F3} cmbDocType
         Height    =   300
         Left      =   1020
         Style     =   2
         TabIndex  =   5
         Top       =   1080
         Width     =   2700
      End

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnCompleteness
         Caption   =   "Completeness Check"
         Height    =   390
         Left      =   120
         TabIndex  =   6
         Top       =   1440
         Width     =   3600
      End

      Begin {978C9E23-D4B0-11CE-BF2D-00AA003F40D0} lblTargetLang
         Caption   =   "Translate to:"
         Height    =   240
         Left      =   120
         TabIndex  =   7
         Top       =   1950
         Width     =   900
      End

      Begin {8BD21D30-EC42-11CE-9E0D-00AA006002F3} cmbTargetLang
         Height    =   300
         Left      =   1080
         Style     =   2
         TabIndex  =   8
         Top       =   1920
         Width     =   2640
      End

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnTranslate
         Caption   =   "Translate Selection"
         Height    =   390
         Left      =   120
         TabIndex  =   9
         Top       =   2280
         Width     =   3600
      End

   End

   ' ── IMAGE TOOLS ──────────────────────────────────────────
   Begin {6E182020-7FEC-11CE-9BD9-0000E202599C} fraImage
      Caption      =   "Image & Color Tools"
      Height       =   2280
      Left         =   60
      TabIndex     =   10
      Top          =   3480
      Width        =   3840

      Begin {8BD21D10-EC42-11CE-9E0D-00AA006002F3} txtPrompt
         Height    =   720
         Left      =   120
         MultiLine =   -1  'True
         ScrollBars=   2  'Vertical
         TabIndex  =   11
         Text      =   ""
         Top       =   180
         Width     =   3600
      End

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnGenerateImage
         Caption   =   "Generate Image (DALL-E 3)"
         Height    =   390
         Left      =   120
         TabIndex  =   12
         Top       =   960
         Width     =   3600
      End

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnColorFromDesc
         Caption   =   "Generate Color Palette"
         Height    =   390
         Left      =   120
         TabIndex  =   13
         Top       =   1410
         Width     =   1740
      End

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnColorFromImage
         Caption   =   "Extract from Image"
         Height    =   390
         Left      =   1980
         TabIndex  =   14
         Top       =   1410
         Width     =   1740
      End

   End

   ' ── FONT TOOLS ───────────────────────────────────────────
   Begin {6E182020-7FEC-11CE-9BD9-0000E202599C} fraFont
      Caption      =   "Font Tools"
      Height       =   840
      Left         =   60
      TabIndex     =   15
      Top          =   5820
      Width        =   3840

      Begin {8BD21D10-EC42-11CE-9E0D-00AA006002F3} txtHeaderFont
         Height    =   300
         Left      =   120
         TabIndex  =   16
         Text      =   "e.g. Playfair Display"
         Top       =   180
         Width     =   2280
      End

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnFontPairing
         Caption   =   "Find Pairings"
         Height    =   300
         Left      =   2460
         TabIndex  =   17
         Top       =   180
         Width     =   1260
      End

   End

   ' ── SETTINGS ─────────────────────────────────────────────
   Begin {6E182020-7FEC-11CE-9BD9-0000E202599C} fraSettings
      Caption      =   "Settings"
      Height       =   600
      Left         =   60
      TabIndex     =   18
      Top          =   6720
      Width        =   3840

      Begin {978C9E23-D4B0-11CE-BF2D-00AA003F40D0} lblModel
         Caption   =   "AI Model:"
         Height    =   240
         Left      =   120
         TabIndex  =   19
         Top       =   180
         Width     =   840
      End

      Begin {8BD21D30-EC42-11CE-9E0D-00AA006002F3} cmbModel
         Height    =   300
         Left      =   1020
         Style     =   2
         TabIndex  =   20
         Top       =   150
         Width     =   2700
      End

   End

   ' ── RESULTS ──────────────────────────────────────────────
   Begin {6E182020-7FEC-11CE-9BD9-0000E202599C} fraResults
      Caption      =   "Results"
      Height       =   2280
      Left         =   60
      TabIndex     =   21
      Top          =   7380
      Width        =   3840

      Begin {8BD21D20-EC42-11CE-9E0D-00AA006002F3} lstResults
         Height    =   1560
         Left      =   120
         TabIndex  =   22
         Top       =   180
         Width     =   3600
      End

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnApply
         Caption   =   "Apply Fix"
         Height    =   360
         Left      =   120
         TabIndex  =   23
         Top       =   1800
         Width     =   1680
      End

      Begin {D7053240-CE69-11CD-A777-00DD01143C57} btnClear
         Caption   =   "Clear"
         Height    =   360
         Left      =   1920
         TabIndex  =   24
         Top       =   1800
         Width     =   1800
      End

   End

End
Attribute VB_Name = "ToolsPanel"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False

Option Explicit

' ============================================================
' ChiroDX Tools Panel v2.0
' ============================================================
' Import this file + ApiClient.bas into your CorelDraw VBA project.
' Run ShowToolsPanel (from ApiClient.bas) to open the panel.
' ============================================================

' Stores result items so the Apply button knows what to patch
Private Type ResultItem
    DisplayText As String   ' shown in lstResults
    OriginalText As String  ' text to find on canvas
    SuggestionText As String ' replacement text
    CanApply As Boolean     ' True = text fix; False = info only
End Type

Private m_Results() As ResultItem
Private m_ResultCount As Integer
Private m_ServerDir As String

' ── Initialise ───────────────────────────────────────────────
Private Sub UserForm_Initialize()
    ' Read server directory from config file (written by setup.bat)
    m_ServerDir = ReadConfigValue("server", "path")

    ' Fallback to default location if config not found
    If Len(m_ServerDir) = 0 Then
        m_ServerDir = Environ("USERPROFILE") & _
                      "\Documents\ChiroDX\corel-custom-tools\ai-server"
    End If

    ' Populate dropdowns
    With cmbDocType
        .AddItem "menu"
        .AddItem "businessCard"
        .AddItem "flyer"
        .AddItem "poster"
        .AddItem "invoice"
        .ListIndex = 0
    End With

    With cmbTargetLang
        .AddItem "en  (English)"
        .AddItem "de  (German)"
        .AddItem "fr  (French)"
        .AddItem "vi  (Vietnamese)"
        .AddItem "tr  (Turkish)"
        .AddItem "es  (Spanish)"
        .AddItem "it  (Italian)"
        .AddItem "ar  (Arabic)"
        .AddItem "zh  (Chinese)"
        .AddItem "pl  (Polish)"
        .AddItem "nl  (Dutch)"
        .ListIndex = 0
    End With

    With cmbModel
        .AddItem "gpt-4o-mini  (Fast & Cheap)"
        .AddItem "gpt-4o  (Best Quality)"
        .AddItem "claude-haiku  (Anthropic)"
        .AddItem "ollama  (Local / Private)"
        .ListIndex = 0
    End With

    ReDim m_Results(0)
    m_ResultCount = 0

    UpdateServerStatus
End Sub

' ── Server status indicator ───────────────────────────────────
Private Sub UpdateServerStatus()
    If IsServerRunning() Then
        lblStatus.Caption = "  Server online"
        lblStatus.ForeColor = &H8000&    ' dark green
    Else
        lblStatus.Caption = "  Server offline — starting..."
        lblStatus.ForeColor = &H808080&  ' grey
        EnsureServerRunning m_ServerDir
        If IsServerRunning() Then
            lblStatus.Caption = "  Server online"
            lblStatus.ForeColor = &H8000&
        Else
            lblStatus.Caption = "  Server offline — run: npm start in ai-server/"
            lblStatus.ForeColor = &HFF&  ' red
        End If
    End If
End Sub

' ── Helpers ───────────────────────────────────────────────────
Private Function SelectedModel() As String
    Select Case cmbModel.ListIndex
        Case 0: SelectedModel = "gpt-4o-mini"
        Case 1: SelectedModel = "gpt-4o"
        Case 2: SelectedModel = "claude-haiku"
        Case 3: SelectedModel = "ollama"
        Case Else: SelectedModel = "gpt-4o-mini"
    End Select
End Function

Private Function SelectedDocType() As String
    If cmbDocType.ListIndex >= 0 Then
        SelectedDocType = cmbDocType.List(cmbDocType.ListIndex)
    Else
        SelectedDocType = "menu"
    End If
End Function

Private Function SelectedTargetLang() As String
    If cmbTargetLang.ListIndex < 0 Then SelectedTargetLang = "en": Exit Function
    Dim entry As String
    entry = cmbTargetLang.List(cmbTargetLang.ListIndex)
    SelectedTargetLang = Trim(Left(entry, InStr(entry, " ") - 1))
End Function

Private Sub SetBusy(ByVal caption As String)
    lblStatus.Caption = "  " & caption & "..."
    lblStatus.ForeColor = &H808080&
End Sub

Private Sub ClearResults()
    lstResults.Clear
    m_ResultCount = 0
    ReDim m_Results(0)
    btnApply.Enabled = False
End Sub

Private Sub AddResult(ByVal displayText As String, _
                      Optional ByVal originalText As String = "", _
                      Optional ByVal suggestionText As String = "", _
                      Optional ByVal canApply As Boolean = False)
    lstResults.AddItem displayText
    m_ResultCount = m_ResultCount + 1
    ReDim Preserve m_Results(m_ResultCount)
    With m_Results(m_ResultCount - 1)
        .DisplayText    = displayText
        .OriginalText   = originalText
        .SuggestionText = suggestionText
        .CanApply       = canApply
    End With
    If canApply Then btnApply.Enabled = True
End Sub

' ── TEXT TOOLS ────────────────────────────────────────────────

Private Sub btnGrammar_Click()
    Dim text As String
    text = GetSelectedText()
    If Len(text) = 0 Then
        MsgBox "Please select a text frame on the canvas first.", vbInformation
        Exit Sub
    End If

    SetBusy "Checking grammar"
    ClearResults

    Dim resp As String
    resp = CheckGrammar(text, SelectedModel())

    If Len(resp) = 0 Then
        AddResult "Error: Could not reach server."
        UpdateServerStatus
        Exit Sub
    End If

    Dim count As Long
    count = JsonGetLong(resp, "count")

    If count = 0 Then
        AddResult "No grammar issues found!"
        UpdateServerStatus
        Exit Sub
    End If

    ' Parse issues array
    Dim issuesJson As String
    issuesJson = JsonGetArray(resp, "issues")
    Dim items() As String
    items = JsonSplitObjects(issuesJson)

    Dim i As Integer
    For i = 0 To UBound(items)
        If Len(Trim(items(i))) > 2 Then
            Dim orig As String: orig = JsonGetString(items(i), "original")
            Dim sug As String:  sug  = JsonGetString(items(i), "suggestion")
            Dim exp As String:  exp  = JsonGetString(items(i), "explanation")
            Dim typ As String:  typ  = JsonGetString(items(i), "type")
            If Len(orig) > 0 And Len(sug) > 0 Then
                AddResult "[" & UCase(Left(typ, 1)) & "] """ & orig & """ → """ & sug & """  (" & exp & ")", _
                          orig, sug, True
            End If
        End If
    Next i

    UpdateServerStatus
End Sub

Private Sub btnPriceFormat_Click()
    Dim text As String
    text = GetAllPageText()
    If Len(text) = 0 Then
        MsgBox "No text found on the current page.", vbInformation
        Exit Sub
    End If

    SetBusy "Checking price formats"
    ClearResults

    Dim resp As String
    resp = CheckPriceFormat(text, SelectedModel())

    If Len(resp) = 0 Then
        AddResult "Error: Could not reach server."
        UpdateServerStatus
        Exit Sub
    End If

    Dim count As Long
    count = JsonGetLong(resp, "count")

    If count = 0 Then
        AddResult "Prices look consistent!"
        UpdateServerStatus
        Exit Sub
    End If

    Dim issuesJson As String
    issuesJson = JsonGetArray(resp, "issues")
    Dim items() As String
    items = JsonSplitObjects(issuesJson)

    Dim i As Integer
    For i = 0 To UBound(items)
        If Len(Trim(items(i))) > 2 Then
            Dim orig As String: orig = JsonGetString(items(i), "original")
            Dim sug As String:  sug  = JsonGetString(items(i), "suggestion")
            Dim exp As String:  exp  = JsonGetString(items(i), "explanation")
            If Len(orig) > 0 Then
                AddResult "[PRICE] """ & orig & """ → """ & sug & """  (" & exp & ")", _
                          orig, sug, (Len(sug) > 0)
            End If
        End If
    Next i

    UpdateServerStatus
End Sub

Private Sub btnCompleteness_Click()
    Dim text As String
    text = GetAllPageText()
    If Len(text) = 0 Then
        MsgBox "No text found on the current page.", vbInformation
        Exit Sub
    End If

    SetBusy "Checking completeness"
    ClearResults

    Dim resp As String
    resp = CheckCompleteness(text, SelectedDocType(), SelectedModel())

    If Len(resp) = 0 Then
        AddResult "Error: Could not reach server."
        UpdateServerStatus
        Exit Sub
    End If

    Dim score As Long
    score = JsonGetLong(resp, "score")
    AddResult "Score: " & score & "% complete"

    ' Missing required fields
    Dim missingJson As String
    missingJson = JsonGetArray(resp, "missingLabels")
    Dim missingItems() As String
    missingItems = JsonSplitArray(missingJson)
    Dim i As Integer
    For i = 0 To UBound(missingItems)
        If Len(Trim(missingItems(i))) > 0 Then
            AddResult "[MISSING] " & missingItems(i)
        End If
    Next i

    ' Present fields
    Dim presentJson As String
    presentJson = JsonGetArray(resp, "presentLabels")
    Dim presentItems() As String
    presentItems = JsonSplitArray(presentJson)
    For i = 0 To UBound(presentItems)
        If Len(Trim(presentItems(i))) > 0 Then
            AddResult "[OK]  " & presentItems(i)
        End If
    Next i

    ' Notes
    Dim notesJson As String
    notesJson = JsonGetArray(resp, "notes")
    Dim noteItems() As String
    noteItems = JsonSplitArray(notesJson)
    For i = 0 To UBound(noteItems)
        If Len(Trim(noteItems(i))) > 0 Then
            AddResult "[NOTE] " & noteItems(i)
        End If
    Next i

    UpdateServerStatus
End Sub

Private Sub btnTranslate_Click()
    Dim text As String
    text = GetSelectedText()
    If Len(text) = 0 Then
        MsgBox "Please select a text frame on the canvas first.", vbInformation
        Exit Sub
    End If

    SetBusy "Translating"
    ClearResults

    Dim resp As String
    resp = TranslateText(text, SelectedTargetLang(), SelectedModel())

    If Len(resp) = 0 Then
        AddResult "Error: Could not reach server."
        UpdateServerStatus
        Exit Sub
    End If

    Dim translated As String
    translated = JsonGetString(resp, "translatedText")

    If Len(translated) = 0 Then
        AddResult "Could not retrieve translation."
    Else
        ' Show translation in results, offer to replace
        Dim lines() As String
        lines = Split(translated, vbNewLine)
        Dim i As Integer
        For i = 0 To UBound(lines)
            If Len(Trim(lines(i))) > 0 Then
                AddResult lines(i)
            End If
        Next i

        ' Offer to apply the full translation to the selected frame
        Dim apply As Integer
        apply = MsgBox("Apply translation to selected text frame?", vbYesNo + vbQuestion)
        If apply = vbYes Then
            On Error Resume Next
            ActiveSelection.Text.Story.Text = translated
            On Error GoTo 0
        End If
    End If

    UpdateServerStatus
End Sub

' ── IMAGE & COLOR TOOLS ───────────────────────────────────────

Private Sub btnGenerateImage_Click()
    Dim prompt As String
    prompt = Trim(txtPrompt.Text)
    If Len(prompt) = 0 Then
        MsgBox "Enter an image description in the prompt box first.", vbInformation
        Exit Sub
    End If

    SetBusy "Generating image"
    ClearResults

    Dim resp As String
    resp = GenerateImage(prompt)

    If Len(resp) = 0 Then
        AddResult "Error: Could not reach server."
        UpdateServerStatus
        Exit Sub
    End If

    If Not JsonGetBool(resp, "ok") Then
        AddResult "Error: " & JsonGetString(resp, "error")
        UpdateServerStatus
        Exit Sub
    End If

    Dim localPath As String
    localPath = JsonGetString(resp, "localPath")
    Dim revised As String
    revised = JsonGetString(resp, "revisedPrompt")

    AddResult "Image saved: " & localPath
    If Len(revised) > 0 And revised <> prompt Then
        AddResult "DALL-E prompt: " & Left(revised, 120) & "..."
    End If

    PlaceImageOnCanvas localPath
    UpdateServerStatus
End Sub

Private Sub btnColorFromDesc_Click()
    Dim desc As String
    desc = Trim(txtPrompt.Text)
    If Len(desc) = 0 Then
        MsgBox "Enter a mood or style description in the prompt box first." & vbNewLine & _
               "Example: ""Upscale Vietnamese restaurant, warm evening""", vbInformation
        Exit Sub
    End If

    SetBusy "Generating color palette"
    ClearResults

    Dim resp As String
    resp = GenerateColorPalette(desc, SelectedModel())

    If Len(resp) = 0 Then
        AddResult "Error: Could not reach server."
        UpdateServerStatus
        Exit Sub
    End If

    Dim colorsJson As String
    colorsJson = JsonGetArray(resp, "colors")
    Dim items() As String
    items = JsonSplitObjects(colorsJson)

    Dim i As Integer
    For i = 0 To UBound(items)
        If Len(Trim(items(i))) > 2 Then
            Dim hex As String:  hex   = JsonGetString(items(i), "hex")
            Dim name As String: name  = JsonGetString(items(i), "name")
            Dim role As String: role  = JsonGetString(items(i), "role")
            Dim cVal As String: cVal  = JsonGetString(items(i), "c")
            Dim mVal As String: mVal  = JsonGetString(items(i), "m")
            Dim yVal As String: yVal  = JsonGetString(items(i), "y")
            Dim kVal As String: kVal  = JsonGetString(items(i), "k")
            If Len(hex) > 0 Then
                AddResult hex & "  " & name & "  [" & role & "]  CMYK(" & cVal & "," & mVal & "," & yVal & "," & kVal & ")"
            End If
        End If
    Next i

    If m_ResultCount = 0 Then AddResult "Could not generate palette."
    UpdateServerStatus
End Sub

Private Sub btnColorFromImage_Click()
    ' VBA needs to export the selected bitmap before sending
    Dim sel As Shape
    On Error Resume Next
    Set sel = ActiveSelection
    On Error GoTo 0

    If sel Is Nothing Then
        MsgBox "Please select a bitmap on the canvas first.", vbInformation
        Exit Sub
    End If
    If sel.Type <> cdrBitmapShape Then
        MsgBox "Selected object is not a bitmap. Please select an image.", vbInformation
        Exit Sub
    End If

    ' Export selected bitmap to temp PNG
    Dim tmpPath As String
    tmpPath = Environ("TEMP") & "\chiroDX_extract_" & Format(Now(), "hhmmss") & ".png"

    On Error GoTo exportFail
    Dim expFilter As ExportFilter
    Set expFilter = sel.Export(tmpPath, cdrPNG)
    expFilter.Finish

    SetBusy "Extracting colors from image"
    ClearResults

    Dim resp As String
    resp = ExtractColorPalette(tmpPath)

    If Len(resp) = 0 Then
        AddResult "Error: Could not reach server."
        UpdateServerStatus
        Exit Sub
    End If

    Dim colorsJson As String
    colorsJson = JsonGetArray(resp, "colors")
    Dim items() As String
    items = JsonSplitObjects(colorsJson)

    Dim i As Integer
    For i = 0 To UBound(items)
        If Len(Trim(items(i))) > 2 Then
            Dim hex As String:  hex  = JsonGetString(items(i), "hex")
            Dim name As String: name = JsonGetString(items(i), "name")
            Dim cVal As String: cVal = JsonGetString(items(i), "c")
            Dim mVal As String: mVal = JsonGetString(items(i), "m")
            Dim yVal As String: yVal = JsonGetString(items(i), "y")
            Dim kVal As String: kVal = JsonGetString(items(i), "k")
            If Len(hex) > 0 Then
                AddResult hex & "  " & name & "  CMYK(" & cVal & "," & mVal & "," & yVal & "," & kVal & ")"
            End If
        End If
    Next i

    If m_ResultCount = 0 Then AddResult "Could not extract colors."
    UpdateServerStatus
    Exit Sub

exportFail:
    MsgBox "Could not export bitmap: " & Err.Description, vbExclamation
End Sub

' ── FONT TOOLS ────────────────────────────────────────────────

Private Sub btnFontPairing_Click()
    Dim font As String
    font = Trim(txtHeaderFont.Text)
    If Len(font) = 0 Or font = "e.g. Playfair Display" Then
        MsgBox "Enter your header/headline font name first.", vbInformation
        Exit Sub
    End If

    SetBusy "Finding font pairings"
    ClearResults

    Dim resp As String
    resp = GetFontPairing(font, SelectedDocType(), SelectedModel())

    If Len(resp) = 0 Then
        AddResult "Error: Could not reach server."
        UpdateServerStatus
        Exit Sub
    End If

    Dim sugJson As String
    sugJson = JsonGetArray(resp, "suggestions")
    Dim items() As String
    items = JsonSplitObjects(sugJson)

    Dim i As Integer
    For i = 0 To UBound(items)
        If Len(Trim(items(i))) > 2 Then
            Dim fname As String:  fname  = JsonGetString(items(i), "font")
            Dim reason As String: reason = JsonGetString(items(i), "reason")
            Dim gf As String:     gf     = JsonGetString(items(i), "googleFonts")
            Dim style As String:  style  = JsonGetString(items(i), "style")
            If Len(fname) > 0 Then
                Dim gfNote As String
                gfNote = IIf(LCase(gf) = "true", " [Google Fonts]", "")
                AddResult fname & "  (" & style & ")" & gfNote
                AddResult "   " & reason
            End If
        End If
    Next i

    If m_ResultCount = 0 Then AddResult "Could not retrieve suggestions."
    UpdateServerStatus
End Sub

' ── RESULTS ACTIONS ───────────────────────────────────────────

Private Sub btnApply_Click()
    Dim idx As Integer
    idx = lstResults.ListIndex
    If idx < 0 Or idx >= m_ResultCount Then
        MsgBox "Select a result item first.", vbInformation
        Exit Sub
    End If

    Dim item As ResultItem
    item = m_Results(idx)

    If Not item.CanApply Then
        MsgBox "This result has no automatic fix to apply.", vbInformation
        Exit Sub
    End If

    ApplyTextFix item.OriginalText, item.SuggestionText
    lstResults.List(idx) = "[APPLIED] " & item.DisplayText
    m_Results(idx).CanApply = False
End Sub

Private Sub btnClear_Click()
    ClearResults
    UpdateServerStatus
End Sub

Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    ' Allow the form to close normally
End Sub
