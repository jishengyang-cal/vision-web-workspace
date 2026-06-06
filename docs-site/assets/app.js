const sections = Array.from(document.querySelectorAll("main section[id]"));
const links = Array.from(document.querySelectorAll(".sidebar a"));

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const id = visible.target.getAttribute("id");
    links.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
    });
  },
  { rootMargin: "-18% 0px -68% 0px", threshold: [0.1, 0.25, 0.5] }
);

sections.forEach((section) => observer.observe(section));

const translationButtons = Array.from(document.querySelectorAll("[data-translate-lang]"));

function canonicalSiteUrl() {
  const configured = document.body.dataset.siteUrl;
  const base = configured || `${window.location.origin}${window.location.pathname}`;
  return new URL(window.location.hash || "", base).toString();
}

translationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetLanguage = button.dataset.translateLang;
    const sourceUrl = canonicalSiteUrl();
    if (targetLanguage === "en") {
      window.location.href = sourceUrl;
      return;
    }
    const translated = new URL("https://translate.google.com/translate");
    translated.searchParams.set("sl", "en");
    translated.searchParams.set("tl", targetLanguage);
    translated.searchParams.set("u", sourceUrl);
    window.location.href = translated.toString();
  });
});
