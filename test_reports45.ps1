$ErrorActionPreference = "Stop"

# Login
$login = Invoke-RestMethod -Method POST -Uri 'http://localhost:8000/api/v1/auth/login' `
    -ContentType 'application/json' `
    -Body '{"email":"test@example.com","password":"TestPass123!"}'
$AT = $login.data.access_token
Write-Host "Logged in OK, token starts: $($AT.Substring(0,20))..." -ForegroundColor Cyan

$headers = @{ Authorization = "Bearer $AT" }

Write-Host "`n=== 4.5 Saved Reports Tests ===" -ForegroundColor Cyan

# POST /reports/saved
Write-Host "`n--- POST /reports/saved (create) ---"
$body = @{
    name       = 'Test Report'
    metrics    = @('spend','clicks','ctr')
    dimensions = @('platform','date')
    filters    = @{ date_from = '2024-01-01'; date_to = '2024-01-31' }
    chart_type = 'bar'
} | ConvertTo-Json -Depth 5

$created = Invoke-RestMethod -Method POST `
    -Uri 'http://localhost:8000/api/v1/reports/saved' `
    -Headers $headers -ContentType 'application/json' -Body $body
Write-Host "PASS  id=$($created.data._id)  name=$($created.data.name)  created_at=$($created.data.created_at)" -ForegroundColor Green
$rid = $created.data._id

# GET /reports/saved (list)
Write-Host "`n--- GET /reports/saved (list) ---"
$list = Invoke-RestMethod -Method GET `
    -Uri 'http://localhost:8000/api/v1/reports/saved' -Headers $headers
Write-Host "PASS  count=$($list.data.Count)" -ForegroundColor Green

# GET /reports/saved/:id
Write-Host "`n--- GET /reports/saved/$rid ---"
$single = Invoke-RestMethod -Method GET `
    -Uri "http://localhost:8000/api/v1/reports/saved/$rid" -Headers $headers
Write-Host "PASS  name=$($single.data.name)  chart_type=$($single.data.chart_type)" -ForegroundColor Green

# GET /reports/saved/bad-id (404)
Write-Host "`n--- GET /reports/saved/000000000000000000000000 (expect 404) ---"
try {
    Invoke-RestMethod -Method GET `
        -Uri 'http://localhost:8000/api/v1/reports/saved/000000000000000000000000' -Headers $headers
    Write-Host "FAIL: expected 404" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) { Write-Host "PASS  got 404" -ForegroundColor Green }
    else { Write-Host "FAIL: got $code" -ForegroundColor Red }
}

# DELETE /reports/saved/:id (204)
Write-Host "`n--- DELETE /reports/saved/$rid (expect 204) ---"
$req = [System.Net.HttpWebRequest]::Create("http://localhost:8000/api/v1/reports/saved/$rid")
$req.Method = 'DELETE'
$req.Headers.Add('Authorization', "Bearer $AT")
try {
    $resp = $req.GetResponse()
    $sc = [int]$resp.StatusCode
    $resp.Close()
    if ($sc -eq 204) { Write-Host "PASS  got 204" -ForegroundColor Green }
    else { Write-Host "FAIL: got $sc" -ForegroundColor Red }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}

# Verify deleted → 404
Write-Host "`n--- GET deleted report (expect 404) ---"
try {
    Invoke-RestMethod -Method GET `
        -Uri "http://localhost:8000/api/v1/reports/saved/$rid" -Headers $headers
    Write-Host "FAIL: expected 404" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) { Write-Host "PASS  got 404" -ForegroundColor Green }
    else { Write-Host "FAIL: got $code" -ForegroundColor Red }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
