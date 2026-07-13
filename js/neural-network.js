const canvas = document.getElementById("network");
const ctx = canvas.getContext("2d");

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

const DPR = window.devicePixelRatio || 1;

canvas.width = width * DPR;
canvas.height = height * DPR;

canvas.style.width = width + "px";
canvas.style.height = height + "px";

ctx.scale(DPR, DPR);

window.addEventListener("resize", () => {

    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * DPR;
    canvas.height = height * DPR;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.scale(DPR, DPR);

    createNodes();

});

const mouse = {

    x: width / 2,
    y: height / 2

};

window.addEventListener("mousemove", e => {

    mouse.x = e.clientX;
    mouse.y = e.clientY;

});

class Node{

    constructor(){

        this.x = Math.random() * width;
        this.y = Math.random() * height;

        this.vx = (Math.random()-.5)*0.35;
        this.vy = (Math.random()-.5)*0.35;

        this.radius = 2 + Math.random()*2;

    }

    update(){

        this.x += this.vx;
        this.y += this.vy;

        if(this.x<0 || this.x>width)
            this.vx *= -1;

        if(this.y<0 || this.y>height)
            this.vy *= -1;

    }

    draw(){

        const dist = Math.hypot(
            this.x-mouse.x,
            this.y-mouse.y
        );

        let glow = Math.max(0,160-dist);

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            this.radius + glow/140,
            0,
            Math.PI*2
        );

        ctx.fillStyle = `rgba(96,165,250,${
            .35 + glow/160
        })`;

        ctx.shadowBlur = glow/3;
        ctx.shadowColor = "#60a5fa";

        ctx.fill();

        ctx.shadowBlur = 0;

    }

}

let nodes=[];

function createNodes(){

    nodes=[];

    const amount = Math.floor(
        (width*height)/9000
    );

    for(let i=0;i<amount;i++){

        nodes.push(new Node());

    }

}

createNodes();

function drawConnections(){

    for(let i=0;i<nodes.length;i++){

        for(let j=i+1;j<nodes.length;j++){

            const dx = nodes[i].x-nodes[j].x;
            const dy = nodes[i].y-nodes[j].y;

            const dist = Math.sqrt(dx*dx+dy*dy);

            if(dist<120){

                let alpha = 1-dist/120;

                const mouseDist=Math.min(
                    Math.hypot(nodes[i].x-mouse.x,nodes[i].y-mouse.y),
                    Math.hypot(nodes[j].x-mouse.x,nodes[j].y-mouse.y)
                );

                if(mouseDist<180)
                    alpha+=0.35;

                ctx.beginPath();

                ctx.moveTo(nodes[i].x,nodes[i].y);
                ctx.lineTo(nodes[j].x,nodes[j].y);

                ctx.strokeStyle=
                `rgba(96,165,250,${alpha*.45})`;

                ctx.lineWidth=1.2;

                ctx.stroke();

            }

        }

    }

}

function animate(){

    ctx.clearRect(0,0,width,height);

    nodes.forEach(node=>{

        node.update();
        node.draw();

    });

    drawConnections();
    updateElectric(ctx, nodes);

    requestAnimationFrame(animate);

}

animate();