from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))
        
        print("Navigating to home page...")
        page.goto("http://localhost:3000/")
        print("Home page title:", page.title())
        
        print("Navigating to services page...")
        try:
            page.goto("http://localhost:3000/services", timeout=10000)
            # Wait a bit to see if anything loads
            page.wait_for_timeout(2000)
            
            content = page.content()
            print("Page content length:", len(content))
            
            if "Professional Printing Services" in content:
                print("Found 'Professional Printing Services' in content")
            else:
                print("'Professional Printing Services' NOT found in content")
                
            h1 = page.query_selector("h1")
            if h1:
                print("H1 found:", h1.inner_text())
            else:
                print("H1 NOT found")
                
        except Exception as e:
            print(f"Error navigating: {e}")
            
        browser.close()

if __name__ == "__main__":
    run()
