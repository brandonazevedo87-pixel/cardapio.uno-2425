import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parent.parent
shots = root / "tests" / "screenshots"
shots.mkdir(exist_ok=True)
origin = os.environ.get("QA_TEST_ORIGIN", "http://localhost:4200")
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/google-chrome"), headless=True, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(origin)
    page.get_by_role("link", name="Criar meu cardápio", exact=True).wait_for()
    assert page.get_by_role("link", name="Made with Runable").count() == 0
    page.screenshot(path=str(shots / "landing-desktop.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=str(shots / "landing-mobile.png"), full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Landing overflow mobile"
    page.goto(origin + "/loja/" + os.environ["QA_SLUG"])
    page.get_by_role("button", name="Burger QA").wait_for()
    page.get_by_role("button", name="Burger QA").click()
    page.get_by_role("button", name="Adicionar •").click()
    page.get_by_role("button", name="Ver meu pedido").click()
    page.get_by_label("Seu nome", exact=True).fill("Cliente navegador QA")
    page.get_by_label("Telefone com DDD").fill("11900000002")
    page.get_by_role("button", name="Confirmar pedido", exact=True).click()
    page.get_by_role("link", name="Acompanhar meu pedido").wait_for()
    page.get_by_role("link", name="Acompanhar meu pedido").click()
    page.get_by_text("Atualização automática a cada 10 segundos.").wait_for()
    page.screenshot(path=str(shots / "tracking-mobile.png"))
    page.goto(origin + "/login")
    page.get_by_label("E-mail", exact=True).fill(os.environ["QA_EMAIL"])
    page.get_by_label("Senha", exact=True).fill(os.environ["QA_PASSWORD"])
    page.get_by_role("button", name="Entrar no painel", exact=True).click()
    page.wait_for_url("**/painel")
    page.get_by_text("Tudo pronto, QA loja 0.").wait_for()
    page.screenshot(path=str(shots / "merchant-mobile.png"))
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Painel overflow mobile"
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.goto(origin + "/painel/produtos")
    page.get_by_role("button", name="Novo produto", exact=True).wait_for()
    page.get_by_role("button", name="Novo produto", exact=True).click()
    page.get_by_label("Nome do produto", exact=True).fill("Produto criado no navegador")
    page.get_by_label("Preço base (R$)").fill("12.50")
    page.locator('input[type="file"]').first.set_input_files(str(root / "packages/web/public/images/burger.jpg"))
    expect(page.get_by_label("Galeria de fotos (uma URL por linha, até 8)")).to_have_value(re.compile(r"https://"), timeout=30000)
    page.get_by_role("button", name="Salvar produto", exact=True).click()
    page.get_by_text("Produto salvo.", exact=True).wait_for()
    page.get_by_role("button", name="Editar Produto criado no navegador").click()
    page.get_by_label("Nome do produto", exact=True).fill("Produto editado no navegador")
    page.get_by_role("button", name="Salvar produto", exact=True).click()
    page.get_by_role("button", name="Editar Produto editado no navegador").wait_for()
    page.on("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Excluir Produto editado no navegador").click()
    page.get_by_text("Produto excluído.", exact=True).wait_for()
    page.goto(origin + "/painel")
    page.get_by_role("button", name="Compartilhar cardápio").click()
    page.locator(".qr-view img").wait_for()
    assert page.locator(".qr-view a[download]").count() == 1
    page.get_by_role("button", name="Fechar", exact=True).click()
    for section in ["categorias", "pedidos", "personalizacao", "relatorios", "assinatura"]:
        page.goto(origin + "/painel/" + section)
        page.locator(".page-heading").wait_for()
        assert page.locator(".notice.error").count() == 0, section
    page.goto(origin + "/painel")
    page.locator(".page-heading").wait_for()
    page.screenshot(path=str(shots / "merchant-desktop.png"))
    page.evaluate("token => localStorage.setItem('cardapio-session', token)", os.environ["QA_ADMIN_TOKEN"])
    page.goto(origin + "/dono")
    page.get_by_label("Senha provisória", exact=True).fill(os.environ["QA_ADMIN_PASSWORD"])
    page.get_by_label("Nova senha (mínimo 12 caracteres)").fill(os.environ["QA_ADMIN_PASSWORD"] + "-alterada")
    page.get_by_role("button", name="Trocar senha e continuar").click()
    page.locator(".page-heading").wait_for()
    for section in ["", "/empresas", "/planos", "/assinaturas", "/relatorios", "/configuracoes"]:
        page.goto(origin + "/dono" + section)
        page.locator(".page-heading").wait_for()
        assert page.locator(".notice.error").count() == 0, section
    page.goto(origin + "/dono")
    page.locator(".page-heading").wait_for()
    page.screenshot(path=str(shots / "admin-desktop.png"))
    assert not errors, errors
    browser.close()
print("Browser OK: desktop/mobile, checkout, acompanhamento, login, CRUD, QR Code e painéis.")