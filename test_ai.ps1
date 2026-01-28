# Test AI Practice Session Edge Function
# Run: .\test_ai.ps1

$headers = @{
  "apikey" = $env:SUPABASE_ANON_KEY
  "Authorization" = "Bearer $env:SUPABASE_ANON_KEY"
  "Content-Type" = "application/json"
}
$body = Get-Content -Raw .\test_request.json

Invoke-RestMethod `
  -Method Post `
  -Uri "$env:SUPABASE_URL/functions/v1/ai-practice-session" `
  -Headers $headers `
  -Body $body
