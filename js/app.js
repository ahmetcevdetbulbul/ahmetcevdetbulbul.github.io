const words = [

"Electrical & Electronics Engineer",

"RF/MW Design Engineer",

"Software Developer",

"Signal Processing",

"Embedded Systems"

];

const typing = document.getElementById("typing");

let wordIndex = 0;
let letter = 0;
let deleting = false;

function type() {

    const current = words[wordIndex];

    if (!deleting) {

        typing.textContent =
            current.substring(0, letter++);

        if (letter > current.length) {

            deleting = true;

            setTimeout(type, 1600);

            return;

        }

    } else {

        typing.textContent =
            current.substring(0, letter--);

        if (letter < 0) {

            deleting = false;

            wordIndex++;

            if (wordIndex >= words.length)
                wordIndex = 0;

        }

    }

    setTimeout(type, deleting ? 40 : 90);

}

type();
