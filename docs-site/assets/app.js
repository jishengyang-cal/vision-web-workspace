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

