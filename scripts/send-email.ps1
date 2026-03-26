param(
    [string]$To = "aditya@giken.co.id",
    [string]$Subject = "IT Daily Report",
    [string]$Body = "Please find the attached daily report.",
    [string]$AttachmentPath = ""
)

try {
    $outlook = New-Object -ComObject Outlook.Application
    $mail = $outlook.CreateItem(0)
    $mail.To = $To
    $mail.Subject = $Subject
    $mail.HTMLBody = $Body
    
    if ($AttachmentPath -ne "" -and (Test-Path $AttachmentPath)) {
        $mail.Attachments.Add($AttachmentPath) | Out-Null
    }
    
    $mail.Send()
    Write-Host "SUCCESS: Email sent to $To"
    exit 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    exit 1
}
