import * as anime from 'animejs';
console.log(typeof anime);
if (typeof anime === 'function' || typeof anime.default === 'function') {
  console.log("Found anime!");
} else {
  console.log(anime);
}
