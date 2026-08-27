// Base44 routes every page at "/PageName"; anything dynamic travels in the query string.
export const pageUrl = (page, params) => {
  const path = `/${String(page).replace(/ /g, "-")}`;
  if (!params) return path;
  const query = new URLSearchParams(params).toString();
  return query ? `${path}?${query}` : path;
};

export const productUrl = (productId) => pageUrl("Product", { id: productId });

export const shopUrl = (params) => pageUrl("Shop", params);
