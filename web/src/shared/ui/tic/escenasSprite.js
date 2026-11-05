// Escenas 8-bit (64x40 px) para Langostin. Escenas: hotel, isla, navidad, playa, alberca, cuarto, sistemas, noche
var ESC_W=64,ESC_H=40,ESC_MX=16,ESC_MY=8;
var ESC_PAL={S:'#7FD0EB',T:'#B8E6F5',N:'#14213D',M:'#0F5C80',A:'#2E86AB',Z:'#F2D6A0',Y:'#D9B77A',G:'#5FAE5A',H:'#2F7D3A',B:'#6B3A2E',U:'#C95B3E',D:'#3A2018',R:'#D8343A',Q:'#F2C230',O:'#F28C28',C:'#F6EBD9',E:'#9AA5AD',F:'#5B6670',P:'#F08A6E',V:'#7B4FA0',I:'#FFFFFF',L:'#C69C6D',X:'#7A2E3A',K:'#2B3440',J:'#0B3A5B',g:'#3FAE5A',t:'#CFE8E8',s:'#C9A66B'};
function esMk(){var G=[],j;for(j=0;j<ESC_H;j++)G.push(new Array(ESC_W).fill(null));
var p=function(x,y,c){x=Math.floor(x);y=Math.floor(y);if(x>=0&&x<ESC_W&&y>=0&&y<ESC_H)G[y][x]=ESC_PAL[c]||null},
r=function(x,y,w,h,c){for(var q=0;q<h;q++)for(var i=0;i<w;i++)p(x+i,y+q,c)};
return{G:G,p:p,r:r}}
function esPalm(b,x,y,h){b.r(x,y,2,h,'B');b.r(x-3,y-1,4,1,'H');b.r(x+2,y-1,4,1,'H');b.r(x-2,y-2,8,1,'H');b.r(x-1,y-3,6,1,'H');b.r(x-4,y,2,1,'H');b.r(x+4,y,2,1,'H')}
function esCloud(b,f,x0,y){var x=((x0+(f>>2))%80)-12;b.r(x,y,7,2,'I');b.r(x+2,y-1,4,1,'I')}
var ESC={
hotel:function(f,b){var p=b.p,r=b.r,i,x;r(0,0,64,34,'S');r(52,2,5,5,'Q');if((f>>2)&1){p(51,4,'Q');p(57,4,'Q');p(54,1,'Q');p(54,7,'Q')}esCloud(b,f,8,5);esCloud(b,f,40,11);
r(5,12,54,22,'C');r(3,8,58,4,'U');r(3,12,58,1,'D');
for(i=0;i<6;i++){x=8+i*9;r(x,15,4,6,'B');r(x+1,14,2,1,'B');r(x+1,16,2,2,'S');r(x,24,4,6,'B');r(x+1,23,2,1,'B');r(x+1,25,2,2,'S')}
esPalm(b,4,22,12);esPalm(b,58,24,10);r(0,34,64,6,'Z');for(i=0;i<20;i++)p((i*29)%64,35+(i*7)%5,'Y')},
isla:function(f,b){var p=b.p,r=b.r,x,y;r(0,0,64,22,'S');r(6,3,5,5,'Q');esCloud(b,f,30,6);var gx=(f*2)%80-8;p(gx,9,'I');p(gx+1,10,'I');p(gx+2,9,'I');p(gx+3,10,'I');p(gx+4,9,'I');
r(0,22,64,18,'M');for(y=24;y<40;y+=4)for(x=0;x<64;x++)if(((x+y*3+(f>>1))%9)<2)p(x,y,'A');
[[31,24,39],[32,20,43],[33,16,47],[34,12,51],[35,10,53],[36,12,51],[37,16,47]].forEach(function(k){r(k[1],k[0],k[2]-k[1]+1,1,k[0]>35?'Y':'Z')});
esPalm(b,50,22,13);esPalm(b,12,28,7)},
navidad:function(f,b){var p=b.p,r=b.r,x,k,lc=['R','Q','S','P'];r(0,0,64,34,'X');r(0,34,64,6,'L');for(x=0;x<64;x+=8)r(x,36,4,1,'Y');
r(4,8,11,14,'N');for(k=0;k<9;k++)p(5+(k*7)%9,9+((f+k*3)%12),'I');
r(3,7,13,1,'B');r(3,22,13,1,'B');r(3,7,1,16,'B');r(15,7,1,16,'B');r(9,8,1,14,'B');r(4,15,11,1,'B');
for(x=0;x<64;x++)p(x,2+((x>>3)&1),'H');for(x=2;x<64;x+=6)p(x,4+((x>>3)&1),lc[(f+((x/6)|0))%4]);
for(k=0;k<19;k++){var hw=1+((k*5/19)|0);r(56-hw,9+k,2*hw+1,1,(k%4<2)?'H':'G')}
r(55,28,3,3,'B');r(55,7,3,1,'Q');p(56,6,'Q');p(56,8,'Q');
[[56,11],[54,15],[58,15],[53,20],[57,19],[60,23],[52,24],[56,25],[59,26]].forEach(function(l,i){p(l[0],l[1],lc[(f+i)%4])});
r(49,30,5,4,'R');r(51,30,1,4,'Q');r(58,31,5,3,'S');r(60,31,1,3,'I')},
playa:function(f,b,fr){var p=b.p,r=b.r,x,y,i;r(0,0,64,17,'S');r(52,3,5,5,'Q');esCloud(b,f,10,7);r(0,17,64,11,'M');for(y=19;y<27;y+=3)for(x=0;x<64;x++)if(((x+y*2+(f>>1))%8)<2)p(x,y,'A');
r(0,27,64,1,'I');r(0,28,64,12,'Z');for(i=0;i<24;i++)p((i*23)%64,29+(i*7)%10,'Y');
r(8,22,1,12,'B');for(x=5;x<=11;x++)p(x,18,(x&1)?'R':'I');for(x=3;x<=13;x++)p(x,19,(x&1)?'R':'I');for(x=2;x<=14;x++)p(x,20,(x&1)?'R':'I');
r(52,30,10,5,'Y');r(53,27,3,3,'Y');r(58,27,3,3,'Y');r(56,23,1,5,'B');r(57,23,3,2,'R');
var cx=2+((f>>1)%56);fr.r(cx,37,5,2,'R');fr.p(cx,36,'R');fr.p(cx+4,36,'R')},
alberca:function(f,b,fr){var p=b.p,r=b.r,x,y,i;r(0,0,64,10,'S');r(52,1,4,4,'Q');esCloud(b,f,20,4);r(0,10,64,13,'C');r(0,7,64,3,'U');r(0,10,64,1,'D');
for(i=0;i<6;i++){x=7+i*10;r(x,13,4,6,'B');r(x+1,14,2,2,'S')}
r(0,23,64,2,'I');r(0,25,64,15,'S');esPalm(b,4,12,11);esPalm(b,58,12,11);
for(y=26;y<31;y+=2)for(x=0;x<64;x++)if(((x+y*2+(f>>1))%9)<2)p(x,y,'T');
fr.r(0,31,64,9,'S');for(y=31;y<40;y++)for(x=0;x<64;x++){if(y==31?((((x>>2)+(f>>1))&1)==0):(((x+y*2+(f>>1))%7)<2))fr.p(x,y,'T')}},
cuarto:function(f,b){var p=b.p,r=b.r,x;r(0,0,64,34,'t');r(0,34,64,6,'L');r(8,35,48,3,'U');
r(4,6,11,14,'S');r(4,13,11,7,'M');for(x=4;x<15;x++)if(((x+(f>>1))%4)==0)p(x,16,'A');
r(3,5,13,1,'B');r(3,20,13,1,'B');r(3,5,1,16,'B');r(15,5,1,16,'B');r(9,6,1,14,'B');r(2,4,3,18,'U');r(14,4,3,18,'U');
r(27,2,10,7,'B');r(28,3,8,5,'S');r(28,6,8,2,'M');p(34,4,'Q');
r(46,15,17,7,'B');r(48,18,5,3,'I');r(56,18,5,3,'I');r(45,22,19,5,'I');r(45,24,19,4,'M');r(45,24,19,1,'A');r(45,28,2,6,'B');r(61,28,2,6,'B')},
sistemas:function(f,b){var p=b.p,r=b.r,x;r(0,0,64,34,'K');r(0,34,64,6,'F');for(x=0;x<64;x+=8)r(x,34,1,6,'K');
[2,50].forEach(function(rx,s){r(rx,4,12,30,'F');for(var k=0;k<6;k++){var y=6+k*5;r(rx+1,y,10,4,'E');p(rx+2,y+1,((f+k+s)%6<3)?'g':'D');p(rx+2,y+2,((f*2+k)%5<2)?'Q':'D');p(rx+9,y+1,((f+k*2)%7<5)?'g':'R');r(rx+4,y+2,4,1,'D')}});
[[18,0],[34,3]].forEach(function(m){r(m[0],3,12,7,'E');r(m[0]+1,4,10,5,'D');for(var k=0;k<5;k++)r(m[0]+1,4+k,3+((k*5+(f>>2)+m[1])%6),1,'g');r(m[0]+5,10,2,1,'E')})},
noche:function(f,b){var p=b.p,r=b.r,k,x,y;r(0,0,64,22,'N');for(k=0;k<14;k++)if((f+k)%7<5)p((k*37)%64,(k*13)%18,'I');
r(50,4,3,1,'Q');r(49,5,5,3,'Q');r(50,8,3,1,'Q');r(52,5,2,3,'N');
r(0,22,64,12,'J');for(k=0;k<6;k++){var rx=50+(((f>>1)+k)%3)-1;r(rx,22+k*2,2,1,'Q')}for(y=24;y<34;y+=3)for(x=0;x<64;x++)if(((x+y*2+(f>>1))%10)<1)p(x,y,'M');
r(0,34,64,6,'s');for(k=0;k<12;k++)p((k*31)%64,35+(k*5)%5,'Y');
r(5,33,9,2,'B');r(7,29,5,4,'R');r(8,27+(f&1),3,4,'O');r(9,26+((f>>1)&1),1,3,'Q');p(4,34,'E');p(14,34,'E');p(8+(f%5),21+((f*2)%6),'Q')}
};
function buildScene(name,f){var b=esMk(),fr=esMk();(ESC[name]||ESC.hotel)(f,b,fr);return{back:b.G,front:fr.G}}
function esPaint(ctx,G,ox,oy){for(var j=0;j<G.length;j++)for(var i=0;i<G[j].length;i++)if(G[j][i]){ctx.fillStyle=G[j][i];ctx.fillRect(i+ox,j+oy,1,1)}}
// m = {build, anim}: build viene de langostinSprite.js. Sin m dibuja solo la escena.
function drawScene(ctx,name,f,m){var s=buildScene(name,f);ctx.clearRect(0,0,ESC_W,ESC_H);esPaint(ctx,s.back,0,0);if(m&&m.build)esPaint(ctx,m.build(m.anim||'idle',f),ESC_MX,ESC_MY);esPaint(ctx,s.front,0,0)}
function mountScene(cv,name,anim,build){cv.width=ESC_W;cv.height=ESC_H;var ctx=cv.getContext('2d'),f=0,m=build?{build:build,anim:anim}:null;drawScene(ctx,name,0,m);return setInterval(function(){f++;drawScene(ctx,name,f,m)},140)}

export {buildScene,drawScene,mountScene};
export const SCENES=['hotel','isla','navidad','playa','alberca','cuarto','sistemas','noche'];
