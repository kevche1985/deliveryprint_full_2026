import pytest
from playwright.sync_api import Page, expect

def test_order_confirmation_localization(page: Page):
    # Navigate to a non-existent order confirmation page
    page.goto("http://localhost:3000/orders/fake-id-123/confirmation")
    
    # Check if we are stuck on loader (wait up to 10s for it to disappear if present)
    # Note: in sync API, we can use expect to wait
    try:
        loader = page.locator("svg.animate-spin").first
        if loader.is_visible():
             expect(loader).to_be_hidden(timeout=10000)
    except:
        pass
        
    # Check English content
    expect(page.locator("h1")).to_contain_text("Authentication Required")
    expect(page.get_by_text("Please log in to view order details.")).to_be_visible()
    expect(page.get_by_role("main").get_by_role("link", name="Log In")).to_be_visible()
    
    # Switch to Spanish
    globe_icon = page.locator("svg.lucide-globe").first
    lang_btn = globe_icon.locator("..")
    lang_btn.click()
    page.get_by_text("Español").click()
    
    # Check Spanish content
    expect(page.locator("h1")).to_contain_text("Autenticación Requerida")
    expect(page.get_by_text("Por favor inicia sesión para ver los detalles del pedido.")).to_be_visible()
    expect(page.get_by_role("main").get_by_role("link", name="Iniciar Sesión")).to_be_visible()
