# Test API endpoint
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/generate-outfits' -Method POST -ContentType 'application/json' -Body @'
{
    "userId": "test-user",
    "items": [
        {
            "id": "1",
            "type": "shirt",
            "color": "blue"
        }
    ],
    "preferences": {
        "style": "casual"
    }
}
'@
    Write-Host "Success: $($response | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Response: $($_.Exception.Response)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
    }
}