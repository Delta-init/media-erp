$login = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/auth/login' `
    -ContentType 'application/json' -Body '{"email":"test@example.com","password":"TestPass123!"}'
$AT = $login.data.access_token

$wr = Invoke-WebRequest -Uri 'http://localhost:8000/api/v1/reports/export?metrics=spend,clicks&dimensions=platform' `
    -Headers @{ Authorization = "Bearer $AT" }

Write-Host "StatusCode: $($wr.StatusCode)"
Write-Host "ContentType: $($wr.Headers['Content-Type'])"
Write-Host "RawContentLength: $($wr.RawContentLength)"
Write-Host "Content: [$($wr.Content)]"
Write-Host "Content bytes: $($wr.RawContentLength)"
