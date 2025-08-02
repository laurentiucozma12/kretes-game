const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let imgKretes = new Image();

imgKretes.addEventListener("load", () => {
  ctx.drawImage(imgKretes, 10, 10);
});

imgKretes.src = "assets/kretes/64x64.png";
