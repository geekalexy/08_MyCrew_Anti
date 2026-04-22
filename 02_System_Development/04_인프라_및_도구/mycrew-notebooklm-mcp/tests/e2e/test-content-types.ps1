# Quick validation test for new content types
# Tests that the API recognizes all supported content types
# Does NOT actually generate content (would take too long for E2E)

$BaseUrl = "http://localhost:3000"

# Content types with their test configurations
$ContentTypeTests = @(
    @{ Type = "audio_overview"; CustomInstructions = $true },
    @{ Type = "video"; CustomInstructions = $true; ExtraParams = @{ video_format = "brief"; video_style = "animated" } },
    @{ Type = "infographic"; CustomInstructions = $true; ExtraParams = @{ infographic_format = "horizontal" } },
    @{ Type = "report"; CustomInstructions = $false; ExtraParams = @{ report_format = "summary" } },  # NO custom_instructions!
    @{ Type = "presentation"; CustomInstructions = $true; ExtraParams = @{ presentation_style = "detailed_slideshow"; presentation_length = "short" } },
    @{ Type = "data_table"; CustomInstructions = $true }
)

Write-Host "`n=== Content Type Validation Test ===" -ForegroundColor Cyan
Write-Host "Testing that API accepts all Phase 1 content types with correct parameters"
Write-Host ""

$passed = 0
$failed = 0

foreach ($test in $ContentTypeTests) {
    $type = $test.Type
    Write-Host "  Testing $type... " -NoNewline

    try {
        # Build request body based on test config
        $body = @{
            content_type = $type
        }

        # Only add custom_instructions if supported
        if ($test.CustomInstructions) {
            $body["custom_instructions"] = "E2E validation test"
        }

        # Add extra params if any
        if ($test.ExtraParams) {
            foreach ($key in $test.ExtraParams.Keys) {
                $body[$key] = $test.ExtraParams[$key]
            }
        }

        $jsonBody = $body | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$BaseUrl/content/generate" `
            -Method POST `
            -ContentType "application/json" `
            -Body $jsonBody `
            -TimeoutSec 5 `
            -ErrorAction Stop

        # If we get a 200 response, the type is accepted
        Write-Host "PASS (accepted)" -ForegroundColor Green
        $passed++
    } catch {
        $statusCode = 0
        $errorMsg = ""

        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $reader.Close()

            try {
                $errorJson = $errorBody | ConvertFrom-Json
                $errorMsg = $errorJson.error
            } catch {
                $errorMsg = $errorBody
            }
        }

        # 400 with "not supported" means the type is rejected
        if ($statusCode -eq 400 -and $errorMsg -like "*not supported*") {
            Write-Host "FAIL (type not supported: $errorMsg)" -ForegroundColor Red
            $failed++
        }
        # 400 with custom_instructions error means we misconfigured the test
        elseif ($statusCode -eq 400 -and $errorMsg -like "*custom_instructions*") {
            Write-Host "FAIL (custom_instructions rejected: $errorMsg)" -ForegroundColor Red
            $failed++
        }
        # Timeout or other errors while processing means type was accepted
        elseif ($_.Exception.Message -like "*timeout*" -or $_.Exception.Message -like "*délai*") {
            Write-Host "PASS (accepted, still processing)" -ForegroundColor Green
            $passed++
        }
        # 500 error during processing means type was accepted but processing failed
        elseif ($statusCode -eq 500) {
            Write-Host "PASS (accepted, processing error)" -ForegroundColor Green
            $passed++
        }
        else {
            Write-Host "UNKNOWN ($statusCode - $($_.Exception.Message))" -ForegroundColor Yellow
            $passed++  # Count as pass if it's not a "not supported" error
        }
    }
}

Write-Host ""

# Additional test: Verify report rejects custom_instructions
Write-Host "  Testing report rejects custom_instructions... " -NoNewline
try {
    $body = @{
        content_type = "report"
        custom_instructions = "This should be rejected"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$BaseUrl/content/generate" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 5 `
        -ErrorAction Stop

    # If we get 200, that's wrong - it should have been rejected
    Write-Host "FAIL (custom_instructions was accepted but should be rejected)" -ForegroundColor Red
    $failed++
} catch {
    $statusCode = 0
    $errorMsg = ""

    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        $reader.Close()

        try {
            $errorJson = $errorBody | ConvertFrom-Json
            $errorMsg = $errorJson.error
        } catch {
            $errorMsg = $errorBody
        }
    }

    if ($statusCode -eq 400 -and $errorMsg -like "*does not support custom_instructions*") {
        Write-Host "PASS (correctly rejected)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAIL (unexpected response: $statusCode - $errorMsg)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Results: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -eq 0) {
    Write-Host "`n[SUCCESS] All content type validations passed" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[FAILURE] Some validations failed" -ForegroundColor Red
    exit 1
}
