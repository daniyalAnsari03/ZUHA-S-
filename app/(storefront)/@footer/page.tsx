/**
 * The footer slot for the homepage.
 *
 * On `/` the footer is not chrome laid out under the page: it is the closing
 * slide of the full-screen slide stack in `components/storefront/home-slides.tsx`,
 * so it has to be rendered inside that stack rather than here. `page.tsx`
 * renders it and hands it to `HomeSlides`.
 *
 * Every other storefront route inherits `default.tsx` and gets an ordinary
 * footer in the normal document flow.
 */
export default function HomeFooterSlot() {
  return null;
}