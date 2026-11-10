# Putting the app online with GitHub Pages

The app is the folder `app`. GitHub Pages serves it at an address like
`https://YOUR-NAME.github.io/four-language-translator/`. After the first visit it also works offline.

You need a free GitHub account (github.com → Sign up).

## The easy way: let Claude upload it

1. On github.com, click **+** (top right) → **New repository**.
2. Name: `four-language-translator`. Choose **Public** (GitHub Pages is free for public repositories). Do not tick any of the boxes. Click **Create repository**.
3. Tell Claude the name of the repository, for example `your-name/four-language-translator`.
   Claude uploads everything and switches GitHub Pages on.
4. When Claude says it is done, open **Settings → Pages** in the repository. The address of the app is shown at the top.

## Doing it yourself in the browser

1. Create the repository as in steps 1 and 2 above.
2. On the empty repository page, click **uploading an existing file**.
3. Unzip `translator-phase3.zip` on your computer. Open the folder `translator`.
   Drag everything inside it (the folders `app`, `build`, `docs` and the files `LICENSES.md`, `HOSTING.md`, `README.md`)
   into the browser window. Wait until all files are listed, then click **Commit changes**.
4. The workflow file has to be added separately, because folders whose name starts with a dot are hidden on most computers:
   click **Add file → Create new file**, type `.github/workflows/pages.yml` as the name,
   paste the contents of the file `docs/pages.yml` from the zip (a visible copy of the same file), and click **Commit changes**.
5. Go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
6. Go to the **Actions** tab. A run called "Publish the app" appears; it takes about a minute.
   When it shows a green tick, the app is online. The address is shown in **Settings → Pages**.

## Updating the app later

Upload the changed files to the same repository (or ask Claude to). The app republishes itself.
People who already use it get the new version the next time they open it with an internet connection.

## Checking offline use

1. Open the app's address once with an internet connection and wait until the cards appear.
2. Switch on flight mode (or, in Chrome on a computer: right-click → Inspect → Network → "Offline").
3. Reload the page. It opens and every word still works.

On a phone you can also add it to the home screen (Safari: Share → Add to Home Screen; Chrome: ⋮ → Add to Home screen).
