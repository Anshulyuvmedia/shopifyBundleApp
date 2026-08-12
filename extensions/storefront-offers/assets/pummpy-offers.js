(function () {
  "use strict";

  var PROXY_PATH = "/apps/shopify-bundle-app/offers";

  function formatMoney(value) {
    var n = Number(value) || 0;
    return "$" + n.toFixed(2);
  }

  var MAX_PRODUCT_NAME_LENGTH = 40;

  function shortenLabel(label) {
    var s = String(label || "Product").trim();
    if (s.length <= MAX_PRODUCT_NAME_LENGTH) return s;
    return s.slice(0, MAX_PRODUCT_NAME_LENGTH - 1).trimEnd() + "\u2026";
  }

  // The /cart/add.js AJAX API needs the NUMERIC variant id (e.g. 47961508970659),
  // not the full GID (gid://shopify/ProductVariant/...).
  function numericId(gid) {
    var s = String(gid || "");
    var i = s.lastIndexOf("/");
    return i === -1 ? s : s.slice(i + 1);
  }

  function tierSaving(tier) {
    var value =
      tier.discountType === "percentage"
        ? tier.discountValue + "% off"
        : formatMoney(tier.discountValue) + " off";
    return "Buy " + tier.minQuantity + "+ save " + value;
  }

  function bundleBadgeLabel(bundle) {
    return (
      "SAVE " +
      (bundle.discountType === "percentage"
        ? bundle.discountValue + "%"
        : formatMoney(bundle.discountValue))
    );
  }

  function bundleBadge(bundle) {
    var badge = el("span", "pummpy-bundle__badge");
    badge.textContent = bundleBadgeLabel(bundle);
    return badge;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // variantId is a full GID (e.g. gid://shopify/ProductVariant/123). The AJAX
  // cart API only accepts numeric variant IDs, so send cartId instead.
  function variantForCart(item) {
    return {
      id: item.cartId || numericId(item.variantId),
      quantity: item.quantity,
    };
  }

  function addToCart(items) {
    return fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: items }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("add failed");
        return res.json();
      })
      .then(function () {
        // Notify the theme (window + document) so cart drawers update.
        window.dispatchEvent(new CustomEvent("cart:updated", { detail: {} }));
        document.dispatchEvent(new CustomEvent("cart:updated", { detail: {} }));
      });
  }

  function buildOffersUrl(params) {
    var query = Object.keys(params)
      .filter(function (key) {
        return params[key];
      })
      .map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      })
      .join("&");
    return PROXY_PATH + (query ? "?" + query : "");
  }

  function renderQuantityBreaks(container, quantityBreaks) {
    if (!quantityBreaks.length) return;

    var section = el("section", "pummpy-qb");
    section.appendChild(el("h3", "pummpy-section-title", "Quantity discounts"));

    quantityBreaks.forEach(function (qb) {
      var card = el("div", "pummpy-qb__card");
      if (qb.title) card.appendChild(el("div", "pummpy-qb__title", qb.title));

      var list = el("ul", "pummpy-qb__tiers");
      qb.tiers.forEach(function (tier) {
        var li = el("li", "pummpy-qb__tier");
        li.appendChild(el("span", "pummpy-qb__tier-qty", "Qty " + tier.minQuantity + "+"));
        li.appendChild(el("span", "pummpy-qb__tier-save", tierSaving(tier)));
        list.appendChild(li);
      });
      card.appendChild(list);
      section.appendChild(card);
    });

    container.appendChild(section);
  }

  function buildBundleItem(item) {
    var li = el("li", "pummpy-bundle__item");

    var thumbWrap = el("span", "pummpy-bundle__thumb-wrap");
    var fallback = el("span", "pummpy-bundle__thumb-fallback");
    fallback.textContent = (item.title || "P").charAt(0).toUpperCase();
    thumbWrap.appendChild(fallback);
    if (item.imageUrl) {
      var img = document.createElement("img");
      img.className = "pummpy-bundle__thumb";
      img.src = item.imageUrl;
      img.alt = item.title || "Product";
      img.loading = "lazy";
      img.onerror = function () {
        img.style.display = "none";
      };
      thumbWrap.appendChild(img);
    }
    if (item.quantity > 1) {
      thumbWrap.appendChild(
        el("span", "pummpy-bundle__thumb-qty", item.quantity + "\u00d7"),
      );
    }
    li.appendChild(thumbWrap);

    var meta = el("div", "pummpy-bundle__item-meta");
    meta.appendChild(
      el("span", "pummpy-bundle__item-name", shortenLabel(item.title)),
    );
    if (item.price != null) {
      var qtyPrice = (Number(item.price) || 0) * (Number(item.quantity) || 1);
      meta.appendChild(
        el("span", "pummpy-bundle__item-price", formatMoney(qtyPrice)),
      );
    }
    li.appendChild(meta);
    return li;
  }

  function buildBundleCard(bundle) {
    var card = el("div", "pummpy-bundle__card pummpy-bundle__card--clickable");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");

    var head = el("div", "pummpy-bundle__head");
    var headText = el("div", "pummpy-bundle__head-text");
    headText.appendChild(el("div", "pummpy-bundle__title", bundle.title));
    if (bundle.description) {
      headText.appendChild(el("div", "pummpy-bundle__desc", bundle.description));
    }
    head.appendChild(headText);
    var badge = bundleBadge(bundle);
    head.appendChild(badge);
    card.appendChild(head);

    var list = el("ul", "pummpy-bundle__items");
    bundle.items.forEach(function (item) {
      list.appendChild(buildBundleItem(item));
    });
    card.appendChild(list);

    function addBundle() {
      if (card.getAttribute("data-pummpy-adding") === "true") return;
      card.setAttribute("data-pummpy-adding", "true");
      card.classList.add("pummpy-bundle__card--adding");
      badge.textContent = "Adding\u2026";
      addToCart(bundle.items.map(variantForCart))
        .then(function () {
          badge.textContent = "Added \u2713";
          setTimeout(function () {
            card.setAttribute("data-pummpy-adding", "false");
            card.classList.remove("pummpy-bundle__card--adding");
            badge.textContent = bundleBadgeLabel(bundle);
          }, 2000);
        })
        .catch(function () {
          card.setAttribute("data-pummpy-adding", "false");
          card.classList.remove("pummpy-bundle__card--adding");
          badge.textContent = "Error \u2013 try again";
          setTimeout(function () {
            badge.textContent = bundleBadgeLabel(bundle);
          }, 2000);
        });
    }

    card.addEventListener("click", addBundle);
    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        addBundle();
      }
    });

    return card;
  }

  function renderBundles(container, bundles) {
    if (!bundles.length) return;

    var section = el("section", "pummpy-bundle");
    var titleRow = el("div", "pummpy-section-title-row");
    titleRow.appendChild(el("h3", "pummpy-section-title", "Bundle & save"));
    titleRow.appendChild(
      el("span", "pummpy-section-subtitle", "Pick a combo and pay less"),
    );
    section.appendChild(titleRow);

    var row = el("div", "pummpy-bundle__row");
    bundles.forEach(function (bundle) {
      row.appendChild(buildBundleCard(bundle));
    });
    section.appendChild(row);

    container.appendChild(section);
  }

  function renderEmpty(container) {
    container.innerHTML = "";
  }

  function moveBelowBuyButton(host) {
    if (host.getAttribute("data-pummpy-after-buy") === "false") return;
    var container = host.closest("#MainContent, main, body") || document;
    var payment = container.querySelector(".shopify-payment-button");
    var form = payment ? payment.closest("form") : null;
    if (!form || !form.parentNode) return;
    if (form.nextSibling) {
      form.parentNode.insertBefore(host, form.nextSibling);
    } else {
      form.parentNode.appendChild(host);
    }
  }

  function initProductWidgets() {
    var hosts = document.querySelectorAll("[data-pummpy-product-id]");
    hosts.forEach(function (host) {
      var productId = host.getAttribute("data-pummpy-product-id");
      var variantIds = host.getAttribute("data-pummpy-variant-ids") || "";
      if (!productId) return;

      moveBelowBuyButton(host);

      var url = buildOffersUrl({
        product_id: productId,
        variant_ids: variantIds,
      });

      fetch(url, { headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("offers failed");
          return res.json();
        })
        .then(function (data) {
          if (!data.bundles.length) {
            renderEmpty(host);
            return;
          }
          host.innerHTML = "";
          renderBundles(host, data.bundles);
        })
        .catch(function () {
          renderEmpty(host);
        });
    });
  }

  function initCartUpsell() {
    var host = document.querySelector("[data-pummpy-cart]");
    if (!host) return;

    var jsonNode = host.querySelector("[data-pummpy-cart-json]");
    var items = [];
    try {
      items = jsonNode ? JSON.parse(jsonNode.textContent) : [];
    } catch (err) {
      items = [];
    }

    var productIds = items.map(function (item) {
      return String(item.product_id);
    });
    var variantIds = items.map(function (item) {
      return String(item.variant_id);
    });

    if (!productIds.length && !variantIds.length) {
      renderEmpty(host);
      return;
    }

    var url = buildOffersUrl({
      product_ids: productIds.join(","),
      variant_ids: variantIds.join(","),
    });

    fetch(url, { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("offers failed");
        return res.json();
      })
      .then(function (data) {
        var body = host.querySelector(".pummpy-cart-upsell__body");
        if (
          (!data.quantityBreaks.length && !data.bundles.length) ||
          !body
        ) {
          host.style.display = "none";
          return;
        }
        body.innerHTML = "";

        var title = el("h3", "pummpy-section-title", "Complete your order");
        body.appendChild(title);

        data.bundles.forEach(function (bundle) {
          var inCart = bundle.matchedVariantIds;
          var missing = bundle.items.filter(function (item) {
            return inCart.indexOf(item.variantId) === -1;
          });
          if (!missing.length) return;

          var card = el("div", "pummpy-bundle__card");
          var head = el("div", "pummpy-bundle__head");
          var headText = el("div", "pummpy-bundle__head-text");
          headText.appendChild(el("div", "pummpy-bundle__title", bundle.title));
          head.appendChild(headText);
          head.appendChild(bundleBadge(bundle));
          card.appendChild(head);

          var missingItems = bundle.items.filter(function (item) {
            return inCart.indexOf(item.variantId) === -1;
          });
          var list = el("ul", "pummpy-bundle__items");
          missingItems.forEach(function (item) {
            list.appendChild(buildBundleItem(item));
          });
          card.appendChild(list);

          var addBtn = el("button", "pummpy-bundle__add");
          addBtn.type = "button";
          addBtn.textContent = "Add missing items";
          addBtn.addEventListener("click", function () {
            addBtn.disabled = true;
            addBtn.textContent = "Adding\u2026";
            addToCart(
              missing.map(variantForCart),
            )
              .then(function () {
                addBtn.textContent = "Added to cart \u2713";
                setTimeout(function () {
                  addBtn.disabled = false;
                  addBtn.textContent = "Add missing items";
                }, 3000);
              })
              .catch(function () {
                addBtn.disabled = false;
                addBtn.textContent = "Error \u2013 try again";
              });
          });
          card.appendChild(addBtn);
          body.appendChild(card);
        });

        data.quantityBreaks.forEach(function (qb) {
          var card = el("div", "pummpy-qb__card");
          if (qb.title) card.appendChild(el("div", "pummpy-qb__title", qb.title));
          var list = el("ul", "pummpy-qb__tiers");
          qb.tiers.forEach(function (tier) {
            var li = el("li", "pummpy-qb__tier");
            li.appendChild(el("span", "pummpy-qb__tier-qty", "Qty " + tier.minQuantity + "+"));
            li.appendChild(el("span", "pummpy-qb__tier-save", tierSaving(tier)));
            list.appendChild(li);
          });
          card.appendChild(list);
          body.appendChild(card);
        });
      })
      .catch(function () {
        host.style.display = "none";
      });
  }

  function initBundleShowcase() {
    var host = document.querySelector("[data-pummpy-bundle-showcase]");
    if (!host) return;

    var url = buildOffersUrl({ all: "1" });
    fetch(url, { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("offers failed");
        return res.json();
      })
      .then(function (data) {
        if (!data.bundles.length) {
          host.style.display = "none";
          return;
        }
        host.innerHTML = "";
        var section = el("section", "pummpy-bundle");
        var heading =
          host.getAttribute("data-pummpy-heading") || "Combo packages";
        section.appendChild(el("h3", "pummpy-section-title", heading));
        data.bundles.forEach(function (bundle) {
          section.appendChild(buildBundleCard(bundle));
        });
        host.appendChild(section);
      })
      .catch(function () {
        host.style.display = "none";
      });
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    initProductWidgets();
    initCartUpsell();
    initBundleShowcase();
  });
})();
