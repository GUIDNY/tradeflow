import Layout from './Layout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import HowItWorks from './pages/HowItWorks';
import Contact from './pages/Contact';

export const PAGES = {
    "Home": Home,
    "Shop": Shop,
    "Product": Product,
    "Cart": Cart,
    "Checkout": Checkout,
    "HowItWorks": HowItWorks,
    "Contact": Contact,
}

export const pagesConfig = {
    mainPage: "Home",
    Layout,
    Pages: PAGES,
};
