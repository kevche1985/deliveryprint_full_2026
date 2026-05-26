import pytest
from playwright.sync_api import Page, expect

def test_order_details_localization(page: Page):
    # Navigate to a fake order page
    page.goto("http://localhost:3000/orders/fake-id-123")
    
    # Check English content
    expect(page.locator("h1")).to_contain_text("Authentication Required")
    expect(page.get_by_text("Please log in to view order details.")).to_be_visible()
    expect(page.get_by_role("main").get_by_role("button", name="Log In")).to_be_visible()
    
    # Switch to Spanish
    globe_icon = page.locator("svg.lucide-globe").first
    lang_btn = globe_icon.locator("..")
    lang_btn.click()
    page.get_by_text("Español").click()
    
    # Check Spanish content
    expect(page.locator("h1")).to_contain_text("Autenticación Requerida")
    expect(page.get_by_text("Por favor inicia sesión para ver los detalles del pedido.")).to_be_visible()
    expect(page.get_by_role("main").get_by_role("button", name="Iniciar Sesión")).to_be_visible()
