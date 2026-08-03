// Positions .hotspot elements so they track the visible (letterboxed) area
// of a background <img> that is displayed with object-fit: contain.
function fitHotspots(imgEl, hotspotEls) {
  function place() {
    const cw = imgEl.clientWidth;
    const ch = imgEl.clientHeight;
    const nw = imgEl.naturalWidth;
    const nh = imgEl.naturalHeight;
    if (!nw || !nh) return;

    const containerRatio = cw / ch;
    const imageRatio = nw / nh;

    let renderW, renderH, offsetX, offsetY;
    if (imageRatio > containerRatio) {
      renderW = cw;
      renderH = cw / imageRatio;
      offsetX = 0;
      offsetY = (ch - renderH) / 2;
    } else {
      renderH = ch;
      renderW = ch * imageRatio;
      offsetY = 0;
      offsetX = (cw - renderW) / 2;
    }

    hotspotEls.forEach(({ el, rect }) => {
      el.style.left = offsetX + rect.left * renderW + 'px';
      el.style.top = offsetY + rect.top * renderH + 'px';
      el.style.width = (rect.right - rect.left) * renderW + 'px';
      el.style.height = (rect.bottom - rect.top) * renderH + 'px';
    });
  }

  if (imgEl.complete) place();
  imgEl.addEventListener('load', place);
  window.addEventListener('resize', place);
}
