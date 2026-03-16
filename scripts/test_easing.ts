import anime from 'animejs';

try {
  const an = anime({
    targets: {},
    translateX: 100,
    easing: 'easeOutSpring(1, 80, 10, 0)',
    duration: 1000
  });
  console.log("Success with easeOutSpring");
} catch (e: any) {
  console.log("Error with easeOutSpring:", e.message);
}

try {
  const an2 = anime({
    targets: {},
    translateX: 100,
    easing: 'spring(1, 80, 10, 0)',
    duration: 1000
  });
  console.log("Success with spring");
} catch (e: any) {
  console.log("Error with spring:", e.message);
}
