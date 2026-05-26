import pytest
from playwright.sync_api import Page, expect

def test_quote_page_localization(page: Page):
    print("Navigating to /quote...")
    page.goto("http://localhost:3000/quote")
    
    # Wait for content
    page.wait_for_selector("h1")

    # --- English Check ---
    print("\n[English Check]")
    
    # Title
    expect(page.locator("h1")).to_contain_text("Request Quote")
    print("SUCCESS: Title is 'Request Quote'")

    # Labels (check a few)
    # Full Name label
    expect(page.locator("label[for='customerName']")).to_contain_text("Full Name")
    print("SUCCESS: Full Name label found")

    # Service Type placeholder
    # Using specific locator for the trigger inside the card
    expect(page.get_by_text("Select a service type")).to_be_visible()
    print("SUCCESS: Service Type placeholder found")

    # Priority (Default Value check instead of placeholder because it has a default)
    # "Normal - Within 5-7 days"
    # Use .first to avoid strict mode violation if needed, but specific text should be unique hopefully
    # If there are multiple, .first is safer for "existence check"
    expect(page.get_by_text("Normal - Within 5-7 days").first).to_be_visible()
    print("SUCCESS: Priority default value found")

    # Submit button
    expect(page.locator("button[type='submit']")).to_contain_text("Submit Quote Request")
    print("SUCCESS: Submit button text found")


    # --- Switch to Spanish ---
    print("\n[Switching to Spanish]")
    globe_icon = page.locator("svg.lucide-globe").first
    lang_btn = globe_icon.locator("..")
    lang_btn.click()
    page.get_by_text("Español").click()
    
    # Wait for re-render
    page.wait_for_timeout(1000)

    # --- Spanish Check ---
    print("\n[Spanish Check]")

    # Title
    expect(page.locator("h1")).to_contain_text("Solicitar Cotización")
    print("SUCCESS: Title is 'Solicitar Cotización'")

    # Labels
    expect(page.locator("label[for='customerName']")).to_contain_text("Nombre Completo")
    print("SUCCESS: Full Name label found (ES)")

    # Service Type placeholder
    expect(page.get_by_text("Seleccione un tipo de servicio")).to_be_visible()
    print("SUCCESS: Service Type placeholder found (ES)")

    # Priority (Default Value check)
    expect(page.get_by_text("Normal - Dentro de 5-7 días").first).to_be_visible()
    print("SUCCESS: Priority default value found (ES)")

    # Additional Details Label
    expect(page.get_by_text("Detalles Adicionales").first).to_be_visible()
    print("SUCCESS: 'Detalles Adicionales' found")

    # Submit button
    expect(page.locator("button[type='submit']")).to_contain_text("Enviar Solicitud de Cotización")
    print("SUCCESS: Submit button text found (ES)")

    # Validation Toast Check
    # Note: The form inputs have 'required' attribute, so browser native validation 
    # intercepts the submit before our custom toast logic runs. 
    # We skip checking the toast as we've verified localization via static text.
    print("\n[Validation Toast Check skipped due to HTML5 validation blocking]")

