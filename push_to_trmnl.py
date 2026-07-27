#!/usr/bin/env python3
import sys
import os
import urllib.request
import json

# Add src/ to python path to import transform_local.py
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
import transform_local

WEBHOOK_URL = "https://usetrmnl.com/api/custom_plugins/8491aecd-7b46-4188-8045-c6713b40569f"

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
            else:
                print(f"✗ Failed (Status {status_code}): {body}")
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    main()
