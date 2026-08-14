# TRMNL Plugin Development Guidelines

This file governs development guidelines and constraints for the Doomsday Clock TRMNL plugin. Follow these instructions at all times.

## 1. Local Testing & Verification
* Before deploying or committing changes, always run the linter and build scripts locally from the `doomsday_clock` directory:
  ```bash
  ./bin/trmnlp lint && ./bin/trmnlp build
  ```
* Ensure no errors or warnings are reported before pushing.

## 2. Layout & Styling Rules
* **Dividers:** Do not use legacy, deprecated, or non-existent classes like `border--h` or `border--h-black` for layout dividers. Always use the standard TRMNL divider component:
  ```html
  <div class="divider mb--2"></div>
  ```
* **Model X Support:**
  * Model X uses a larger screen resolution. When adapting coordinates or dimensions, dynamically check for Model X dimensions:
    ```javascript
    const trmnlDevice = (input && (input.device || (input.trmnl && input.trmnl.device))) || {};
    const deviceWidth = trmnlDevice.width ? parseInt(trmnlDevice.width) : 800;
    const isModelX = deviceWidth > 800;
    ```
  * Adjust margins, graph width (`graphW`), and coordinates accordingly.

## 3. Deployments & Syncing
* **Direct Uploads:** If you need to sync local changes immediately with the TRMNL server (e.g. for testing or bypass CI delays), run:
  ```bash
  ./bin/trmnlp push --force
  ```
* **CI/CD Verification:**
  * When changes are pushed to GitHub `main`, a GitHub Actions workflow automatically deploys them using `trmnlp push`.
  * **Always check the status of the GitHub Actions run after pushing.** If the push job fails, verify that the `TRMNL_API_KEY` repository secret is configured with the correct developer token on GitHub.
