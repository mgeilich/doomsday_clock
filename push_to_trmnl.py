#!/usr/bin/env python3
import sys
import os
import urllib.request
import json

import urllib.error
import time

# Add src/ to python path to import transform_local.py
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
import transform_local

WEBHOOK_URL = "https://usetrmnl.com/api/custom_plugins/2808ed5d-a3d5-4304-a963-52a03987366d"
def main():
    target_year = "latest"
    if len(sys.argv) > 1:
        target_year = sys.argv[1]

    # Construct inputs
    input_data = {
        "plugin_settings": {
            "custom_fields_values": {
                "selected_year": target_year
            }
        }
    }

    # Run local transform logic
    print(f"Calculating settings for year: {target_year}...")
    variables = transform_local.run(input_data)

    # Wrap in merge_variables block for Webhook API
    payload = {
        "merge_variables": variables
    }

    # POST payload using standard urllib library (no external dependencies)
    print(f"Sending payload to TRMNL Webhook: {WEBHOOK_URL}...")
    data = json.dumps(payload).encode('utf-8')
    
    max_retries = 5
    retry_delay = 5  # start with 5 seconds

    for attempt in range(max_retries):
        req = urllib.request.Request(
            WEBHOOK_URL,
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        try:
            with urllib.request.urlopen(req) as response:
                status_code = response.getcode()
                body = response.read().decode('utf-8')
                if status_code == 200:
                    print("✓ Successfully updated TRMNL Dashboard!")
                    break
                else:
                    print(f"✗ Failed (Status {status_code}): {body}")
                    break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"⚠ TRMNL Rate Limit hit (HTTP 429). Retrying in {retry_delay}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                try:
                    error_msg = e.read().decode('utf-8')
                except Exception:
                    error_msg = str(e)
                print(f"✗ HTTP Error {e.code}: {error_msg}")
                break
        except Exception as e:
            print(f"✗ Error: {e}")
            break

if __name__ == "__main__":
    main()
