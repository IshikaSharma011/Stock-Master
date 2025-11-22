/* StockNova — FINAL Unified System (Auth + Products + Inventory)
   Extended with UI handlers for index.html panels (add product, receipt, delivery)
*/

(() => {

  /****************************************
   * BASIC HELPERS
   ****************************************/
  const $ = id => document.getElementById(id);

  const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const isValidMobile = m => {
    const digits = m.replace(/[^\d]/g,'');
    return digits.length >= 7 && digits.length <= 15;
  };

  const uid = () => "id_" + Math.random().toString(36).slice(2,10);

  function load(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }

  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }



  /****************************************
   * AUTH MODULE (Signup / Login / Reset)
   ****************************************/
  const USER_KEY = "stockNova_user";

  function saveUser(u) { save(USER_KEY, u); }
  function loadUser() { return load(USER_KEY, null); }
  function userExists(email) {
    const u = loadUser();
    return u && u.email === email;
  }
  function logoutUser(){
    // keep data, just remove user
    localStorage.removeItem(USER_KEY);
    location.reload();
  }


  /****************************************
   * INVENTORY DATABASE KEYS
   ****************************************/
  const DB = {
    products: "stockNova_products",
    inventory: "stockNova_inventory",
    receipts: "stockNova_receipts",
    deliveries: "stockNova_deliveries",
    transfers: "stockNova_transfers",
    adjustments: "stockNova_adjustments"
  };


  /****************************************
   * PRODUCT SYSTEM
   ****************************************/

  // Add new product
  window.addProduct = (prod) => {
    const products = load(DB.products);
    prod.id = uid();
    prod.createdAt = Date.now();

    products.push(prod);
    save(DB.products, products);

    // Add stock entry
    const inv = load(DB.inventory);
    inv.push({
      productId: prod.id,
      stock: parseInt(prod.initial || 0, 10) || 0
    });
    save(DB.inventory, inv);

    return prod.id;
  };

  window.getProducts = () => load(DB.products);


  /****************************************
   * STOCK CONTROL
   ****************************************/
  function updateStock(productId, change) {
    const inv = load(DB.inventory);
    const item = inv.find(i => i.productId === productId);
    if (!item) return;

    item.stock += change;
    if (item.stock < 0) item.stock = 0;

    save(DB.inventory, inv);
  }

  window.getStock = (productId) => {
    const inv = load(DB.inventory);
    const item = inv.find(i => i.productId === productId);
    return item ? item.stock : 0;
  };


  /****************************************
   * RECEIPTS (INWARD)
   ****************************************/
  window.addReceipt = (data) => {
    const list = load(DB.receipts);
    const entry = { id: uid(), date: Date.now(), ...data };
    list.push(entry);
    save(DB.receipts, list);

    updateStock(data.productId, data.qty);

    return entry.id;
  };

  window.getReceipts = () => load(DB.receipts);


  /****************************************
   * DELIVERIES (OUTWARD)
   ****************************************/
  window.addDelivery = (data) => {
    const list = load(DB.deliveries);
    const entry = { id: uid(), date: Date.now(), ...data };
    list.push(entry);
    save(DB.deliveries, list);

    updateStock(data.productId, -data.qty);

    return entry.id;
  };

  window.getDeliveries = () => load(DB.deliveries);


  /****************************************
   * TRANSFERS
   ****************************************/
  window.addTransfer = (data) => {
    const list = load(DB.transfers);
    const entry = { id: uid(), date: Date.now(), ...data };
    list.push(entry);
    save(DB.transfers, list);

    // For demo: no stock change
    return entry.id;
  };

  window.getTransfers = () => load(DB.transfers);


  /****************************************
   * ADJUSTMENTS
   ****************************************/
  window.addAdjustment = (data) => {
    const list = load(DB.adjustments);
    const entry = { id: uid(), date: Date.now(), ...data };
    list.push(entry);
    save(DB.adjustments, list);

    updateStock(data.productId, data.adjustment);

    return entry.id;
  };

  window.getAdjustments = () => load(DB.adjustments);



  /****************************************
   * AUTH MODAL & UI HANDLING
   ****************************************/
  const authModal = $("authModal");
  const openAuthBtns = [ $("openAuthBtn"), $("openAuthHero"), $("openAuthHero2"), $("openAuthCard"), $("ctaOpen") ];
  const closeAuth = $("closeAuth");

  const tabLogin = $("tabLogin"),
        tabSignup = $("tabSignup"),
        tabReset = $("tabReset");

  const panelLogin = $("panelLogin"),
        panelSignup = $("panelSignup"),
        panelReset = $("panelReset");

  const loginBtn = $("loginBtn"),
        signupBtn = $("signupBtn"),
        resetBtn = $("resetBtn");

  const openResetFromLogin = $("openResetFromLogin") || $("openResetFromLogin") || $("openResetFromLogin"),
        toLoginFromSignup = $("toLoginFromSignup"),
        toLoginFromReset = $("toLoginFromReset");

  const loginMsg = $("loginMessage"),
        signupMsg = $("signupMessage"),
        resetMsg = $("resetMessage");

  function openModal() {
    if(authModal) {
      authModal.classList.remove("hidden");
      showPanel("login");
    }
  }

  function closeModal() {
    if(authModal) {
      authModal.classList.add("hidden");
      clearMessages();
    }
  }

  openAuthBtns.forEach(b => {
    if (b) b.addEventListener("click", e => {
      e.preventDefault();
      openModal();
    });
  });

  if (closeAuth) closeAuth.addEventListener("click", closeModal);
  if (authModal) authModal.addEventListener("click", e => {
    if (e.target === authModal) closeModal();
  });

  function showPanel(which) {
    [tabLogin, tabSignup, tabReset].forEach(t => t && t.classList.remove("active"));
    [panelLogin, panelSignup, panelReset].forEach(p => p && p.classList.add("hidden"));

    if (which === "login" && tabLogin && panelLogin)  { tabLogin.classList.add("active"); panelLogin.classList.remove("hidden"); }
    if (which === "signup" && tabSignup && panelSignup) { tabSignup.classList.add("active"); panelSignup.classList.remove("hidden"); }
    if (which === "reset" && tabReset && panelReset)  { tabReset.classList.add("active"); panelReset.classList.remove("hidden"); }

    clearMessages();
  }

  tabLogin && tabLogin.addEventListener("click", () => showPanel("login"));
  tabSignup && tabSignup.addEventListener("click", () => showPanel("signup"));
  tabReset && tabReset.addEventListener("click", () => showPanel("reset"));

  // fallback ids used in previous HTML
  document.getElementById('openResetFromLogin')?.addEventListener('click', ()=> showPanel('reset'));
  document.getElementById('toLoginFromSignup')?.addEventListener('click', ()=> showPanel('login'));
  document.getElementById('toLoginFromReset')?.addEventListener('click', ()=> showPanel('login'));

  function clearMessages() {
    [loginMsg, signupMsg, resetMsg].forEach(el => {
      if(el){ el.textContent = ""; el.classList.remove("success"); }
    });
  }


  /****************************************
   * SIGNUP
   ****************************************/
  signupBtn && signupBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if(!signupMsg) return;
    signupMsg.classList.remove("success");

    const user = {
      name: $("name").value.trim(),
      mobile: $("mobile").value.trim(),
      email: ($("signupEmail").value || "").trim().toLowerCase(),
      gender: $("gender").value,
      role: $("role").value,
      city: $("city").value.trim(),
      password: $("signupPassword").value
    };

    if(!user.name) return signupMsg.textContent = "Enter full name.";
    if(!isValidMobile(user.mobile)) return signupMsg.textContent = "Invalid mobile number.";
    if(!isValidEmail(user.email)) return signupMsg.textContent = "Invalid email.";
    if(!user.role) return signupMsg.textContent = "Select a role.";
    if(user.password.length < 6) return signupMsg.textContent = "Password must be 6+ chars.";
    if(userExists(user.email)) return signupMsg.textContent = "Email already exists.";

    saveUser(user);

    signupMsg.classList.add("success");
    signupMsg.textContent = "Account created successfully!";

    setTimeout(() => {
      showPanel("login");
      $("loginEmail").value = user.email;
      if(loginMsg){ loginMsg.classList.add("success"); loginMsg.textContent = "Now login."; }
    }, 800);
  });


  /****************************************
   * LOGIN
   ****************************************/
  loginBtn && loginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if(!loginMsg) return;

    const email = ($("loginEmail").value || "").trim().toLowerCase();
    const pwd = $("loginPassword").value;
    const user = loadUser();

    if(!isValidEmail(email)) return loginMsg.textContent = "Enter valid email.";
    if(!user) return loginMsg.textContent = "User not registered.";
    if(email !== user.email) return loginMsg.textContent = "Incorrect email.";
    if(pwd !== user.password) return loginMsg.textContent = "Incorrect password.";

    loginMsg.classList.add("success");
    loginMsg.textContent = "Login successful — redirecting...";

    // mark session (for demo we use a flag)
    localStorage.setItem('stockNova_logged_in', user.email);

    setTimeout(() => {
      closeModal();
      refreshUIForUser();
    }, 600);
  });


  /****************************************
   * RESET PASSWORD (Simulation)
   ****************************************/
  resetBtn && resetBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if(!resetMsg) return;

    const email = ($("resetEmail").value || "").trim().toLowerCase();
    const user = loadUser();

    if(!isValidEmail(email)) return resetMsg.textContent = "Invalid email.";
    if(!user || user.email !== email) return resetMsg.textContent = "Email not found.";

    resetMsg.classList.add("success");
    resetMsg.textContent = "Reset link sent (simulation).";
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape" && authModal && !authModal.classList.contains("hidden")) closeModal();
  });

  window.openAuthModal = openModal;


  /****************************************
   * UI: Product/Receipt/Delivery Handlers
   ****************************************/
  function showProductsUI(){
    const list = getProducts();
    const container = $("productList");
    if(!container) return;

    if(list.length === 0){
      container.innerHTML = "<p style='color:var(--muted)'>No products yet.</p>";
      return;
    }

    container.innerHTML = list.map(p => {
      const stock = getStock(p.id);
      return `<div class="list-item">
                <div>
                  <strong>${escapeHtml(p.name)}</strong> <small>${p.sku ? `· ${escapeHtml(p.sku)}` : ''}</small>
                  <div style="color:var(--muted);font-size:12px">${p.uom ? escapeHtml(p.uom) : ''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="tag">${stock} ${p.uom || ''}</div>
                </div>
              </div>`;
    }).join('');
  }

  function populateProductSelects(){
    const products = getProducts();
    const rsel = $("r_product"), dsel = $("d_product");
    if(rsel) rsel.innerHTML = products.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    if(dsel) dsel.innerHTML = products.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }

  function clearFormInputs(ids){
    ids.forEach(id => { if($(id)) $(id).value = ''; });
  }

  function escapeHtml(str){
    if(!str) return '';
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  // Add Product UI
  const addProdBtn = $("addProdBtn");
  addProdBtn && addProdBtn.addEventListener("click", ()=> {
    const name = ($("p_name").value || "").trim();
    const sku = ($("p_sku").value || "").trim();
    const uom = ($("p_uom").value || "").trim();
    const initial = parseInt($("p_initial").value || 0, 10) || 0;
    const prodMsg = $("prodMsg");

    if(!name){ if(prodMsg) prodMsg.textContent = "Enter product name."; return; }

    const id = addProduct({ name, sku, uom, initial });
    if(prodMsg){ prodMsg.classList.add("success"); prodMsg.textContent = "Product added."; }
    clearFormInputs(["p_name","p_sku","p_uom","p_initial"]);
    populateProductSelects();
    showProductsUI();
  });

  // Create Receipt UI
  $("createReceiptBtn")?.addEventListener("click", ()=>{
    const supplier = ($("r_supplier").value || "").trim();
    const productId = $("r_product")?.value;
    const qty = parseInt($("r_qty").value || 0, 10) || 0;
    const receiptMsg = $("receiptMsg");

    if(!supplier || !productId || qty <= 0){ if(receiptMsg) receiptMsg.textContent = "Fill all fields correctly."; return; }

    addReceipt({ supplier, productId, qty });
    if(receiptMsg){ receiptMsg.classList.add("success"); receiptMsg.textContent = "Receipt created."; }
    clearFormInputs(["r_supplier","r_qty"]);
    showProductsUI();
  });

  // Create Delivery UI
  $("createDeliveryBtn")?.addEventListener("click", ()=>{
    const customer = ($("d_customer").value || "").trim();
    const productId = $("d_product")?.value;
    const qty = parseInt($("d_qty").value || 0, 10) || 0;
    const deliveryMsg = $("deliveryMsg");

    if(!customer || !productId || qty <= 0){ if(deliveryMsg) deliveryMsg.textContent = "Fill all fields correctly."; return; }

    const stock = getStock(productId);
    if(qty > stock){ if(deliveryMsg) deliveryMsg.textContent = "Not enough stock."; return; }

    addDelivery({ customer, productId, qty });
    if(deliveryMsg){ deliveryMsg.classList.add("success"); deliveryMsg.textContent = "Delivery created."; }
    clearFormInputs(["d_customer","d_qty"]);
    showProductsUI();
  });


  /****************************************
   * UI: Session / User toggles
   ****************************************/
  function refreshUIForUser(){
    const logged = localStorage.getItem('stockNova_logged_in');
    const userArea = document.querySelector('.user-area');
    const openAuthEls = document.querySelectorAll('.open-auth');

    if(logged && userArea){
      // show name (from stored user)
      const user = loadUser();
      document.getElementById('userNameDisplay').textContent = user ? (user.name || user.email) : logged;
      userArea.style.display = 'flex';
      openAuthEls.forEach(el => el.style.display = 'none');
    } else {
      if(userArea) userArea.style.display = 'none';
      openAuthEls.forEach(el => el.style.display = 'inline-block');
    }
  }

  // logout hook
  $("logoutBtn")?.addEventListener("click", (e)=> {
    e.preventDefault();
    localStorage.removeItem('stockNova_logged_in');
    refreshUIForUser();
  });


  /****************************************
   * ON READY
   ****************************************/
  document.addEventListener("DOMContentLoaded", ()=>{
    populateProductSelects();
    showProductsUI();
    refreshUIForUser();

    // wire extra open-auth class buttons in case ids changed
    document.querySelectorAll('.open-auth').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.preventDefault();
        openModal();
      });
    });
  });


  /****************************************
   * Expose some helpers for console
   ****************************************/
  window._SN = {
    getProducts: getProducts,
    getStock: getStock,
    addProduct: window.addProduct,
    addReceipt: window.addReceipt,
    addDelivery: window.addDelivery,
    logout: logoutUser
  };

})();
