$login = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/auth/login' `
    -ContentType 'application/json' -Body '{"email":"test@example.com","password":"TestPass123!"}'
$AT = $login.data.access_token

Write-Host "--- CSV export via curl ---"
$url = "http://localhost:8000/api/v1/reports/export?metrics=spend,clicks,ctr&dimensions=platform,date&date_from=2024-01-01&date_to=2024-01-31"
$result = & curl.exe -s -D - -H "Authorization: Bearer $AT" $url
Write-Host ($result -join "`n")
