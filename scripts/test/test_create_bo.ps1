#!/usr/bin/env pwsh
# Test script to create Bo Tipp player and verify login

$SUPABASE_URL = "https://bcfemytoburctssnemwn.supabase.co"
$SUPABASE_ANON_KEY = (Get-Content .env.local | Select-String "VITE_SUPABASE_ANON_KEY").ToString().Split("=")[1]

Write-Host "=== PHASE 5: Create Bo Tipp Player Test ===" -ForegroundColor Cyan
Write-Host ""

# Known facts from user
$TEAM_ID = "d02aba3e-3c30-430f-9377-3b334cffcd04"
$TEAM_JOIN_CODE = "FIRE11"
$MANAGER_USER_ID = "45fcd04b-26b2-4c9c-9e7f-fc84db624d1c"

Write-Host "Step 1: Get manager session token (you need to provide this)" -ForegroundColor Yellow
Write-Host "Manager User ID: $MANAGER_USER_ID" -ForegroundColor Gray
Write-Host "Please login as manager in the app, then run in browser console:" -ForegroundColor Yellow
Write-Host '(await supabase.auth.getSession()).data.session.access_token' -ForegroundColor Green
Write-Host ""
$MANAGER_TOKEN = Read-Host "Paste manager access token here"

if (!$MANAGER_TOKEN) {
    Write-Host "ERROR: Manager token required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Call create-player Edge Function" -ForegroundColor Yellow

$createPlayerBody = @{
    firstName = "Bo"
    lastName = "Tipp"
    jerseyNumber = 58
    pin = "1234"
    teamId = $TEAM_ID
} | ConvertTo-Json

$createPlayerResponse = Invoke-RestMethod `
    -Uri "$SUPABASE_URL/functions/v1/create-player" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $MANAGER_TOKEN"
        "Content-Type" = "application/json"
        "apikey" = $SUPABASE_ANON_KEY
    } `
    -Body $createPlayerBody `
    -ErrorAction Stop

Write-Host "CREATE PLAYER RESPONSE:" -ForegroundColor Green
$createPlayerResponse | ConvertTo-Json -Depth 3
Write-Host ""

if ($createPlayerResponse.success) {
    $BO_PLAYER_ID = $createPlayerResponse.player_id
    $BO_DISPLAY_NAME = $createPlayerResponse.display_name

    Write-Host "✅ Player created successfully!" -ForegroundColor Green
    Write-Host "   Player ID: $BO_PLAYER_ID" -ForegroundColor Gray
    Write-Host "   Display Name: $BO_DISPLAY_NAME" -ForegroundColor Gray
    Write-Host ""

    Write-Host "Step 3: Test player login with PIN" -ForegroundColor Yellow

    $loginBody = @{
        teamJoinCode = $TEAM_JOIN_CODE
        displayName = $BO_DISPLAY_NAME
        pin = "1234"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/player-login" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "apikey" = $SUPABASE_ANON_KEY
        } `
        -Body $loginBody `
        -ErrorAction Stop

    Write-Host "PLAYER LOGIN RESPONSE:" -ForegroundColor Green
    Write-Host "   Access Token: $($loginResponse.access_token.Substring(0,20))..." -ForegroundColor Gray
    Write-Host "   User ID: $($loginResponse.user.id)" -ForegroundColor Gray
    Write-Host "   Email: $($loginResponse.user.email)" -ForegroundColor Gray
    Write-Host ""

    Write-Host "✅ LOGIN SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== TEST CHECKLIST ===" -ForegroundColor Cyan
    Write-Host "✅ Manager authenticated" -ForegroundColor Green
    Write-Host "✅ Bo Tipp created (Bo58, PIN:1234)" -ForegroundColor Green
    Write-Host "✅ Player login successful with team join code" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Open http://localhost:3002" -ForegroundColor Gray
    Write-Host "2. Switch to Player mode" -ForegroundColor Gray
    Write-Host "3. Team Join Code: FIRE11" -ForegroundColor Gray
    Write-Host "4. Display Name: Bo58" -ForegroundColor Gray
    Write-Host "5. PIN: 1234" -ForegroundColor Gray
    Write-Host "6. Verify player can ONLY access player_dm (not team chat)" -ForegroundColor Gray

} else {
    Write-Host "❌ Player creation failed: $($createPlayerResponse.error)" -ForegroundColor Red
    exit 1
}
