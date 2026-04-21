import webview
import time
import urllib.request
from urllib.error import URLError

def wait_for_server(url, timeout=30):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            # We just want a simple ping to see if Vite answered
            urllib.request.urlopen(url)
            return True
        except URLError:
            time.sleep(1)
    return False

if __name__ == '__main__':
    url = 'http://localhost:5173'
    
    # Optional wait loop so we don't open the window on a blank site
    wait_for_server(url)
    
    # Initialize the invisible OS webview to cage the Vite dashboard
    window = webview.create_window(
        'Hearth OS', 
        url,
        width=1280, 
        height=800,
        resizable=True,
        text_select=False,
        background_color='#020804'
    )
    
    # Boot the Native Window Loop
    webview.start(private_mode=False)
