async function loadHTML(selector, url) {
  const response = await fetch(url);
  if (response.ok) {
    const text = await response.text();
    document.querySelector(selector).innerHTML = text;

    if (selector === 'header') {
      const logo = document.getElementById("logo-link");
      if (logo) {
        logo.addEventListener("click", function (e) {
          e.preventDefault();
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        });
      }
    }
  }
}
window.addEventListener('DOMContentLoaded', () => {
  loadHTML('header', 'header.html');
  loadHTML('footer', 'menu.html');
});

