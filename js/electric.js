// ===========================================
// ELECTRIC ENERGY EFFECT
// ===========================================

const electricBolts = [];

class ElectricBolt {

    constructor(a, b) {

        this.a = a;
        this.b = b;

        this.progress = Math.random();

        this.speed = 0.01 + Math.random() * 0.015;

        this.life = 40 + Math.random() * 30;

        this.maxLife = this.life;

    }

    update() {

        this.progress += this.speed;

        this.life--;

    }

    draw(ctx) {

        if (this.life <= 0) return;

        const x =
            this.a.x +
            (this.b.x - this.a.x) * this.progress;

        const y =
            this.a.y +
            (this.b.y - this.a.y) * this.progress;

        const g = ctx.createRadialGradient(
            x,
            y,
            0,
            x,
            y,
            12
        );

        g.addColorStop(0, "#ffffff");
        g.addColorStop(.2, "#67e8f9");
        g.addColorStop(.5, "#3b82f6");
        g.addColorStop(1, "transparent");

        ctx.beginPath();

        ctx.fillStyle = g;

        ctx.arc(x, y, 10, 0, Math.PI * 2);

        ctx.fill();

    }

}

function spawnElectric(nodes){

    if(Math.random()>.08) return;

    const first=Math.floor(Math.random()*nodes.length);

    let second=first;

    while(second===first){

        second=Math.floor(Math.random()*nodes.length);

    }

    const dx=nodes[first].x-nodes[second].x;
    const dy=nodes[first].y-nodes[second].y;

    const dist=Math.sqrt(dx*dx+dy*dy);

    if(dist<140){

        electricBolts.push(

            new ElectricBolt(

                nodes[first],

                nodes[second]

            )

        );

    }

}

function updateElectric(ctx,nodes){

    spawnElectric(nodes);

    for(let i=electricBolts.length-1;i>=0;i--){

        const bolt=electricBolts[i];

        bolt.update();

        bolt.draw(ctx);

        if(
            bolt.life<=0 ||
            bolt.progress>=1
        ){

            electricBolts.splice(i,1);

        }

    }

}