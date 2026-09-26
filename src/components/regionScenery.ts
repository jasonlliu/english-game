import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RegionId } from '../game/adventure';
import { getTerrainHeight } from '../game/world';

/** Original regional architecture. Static geometry is combined by material after construction. */
export function createRegionScenery(region: RegionId) {
  const group=new THREE.Group();group.name=`architecture-${region}`;
  const staticRoot=new THREE.Group();group.add(staticRoot);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  const textures:THREE.Texture[]=[];
  const movers:Array<(time:number)=>void>=[];
  const palettes={
    meadow:['#d8c9a3','#8d947b','#56787b','#6c5140','#ded5b2'],
    water:['#edf0db','#9fbbb9','#4794aa','#87796a','#f4e8c5'],
    fire:['#716a72','#45464f','#718692','#66585a','#dfddda'],
    earth:['#d1a16e','#9c6848','#9d5e43','#846445','#efd0a1'],
    steel:['#a8b9be','#697f8b','#566f7c','#667779','#c5d1cc'],
    fairy:['#dccac8','#a695ae','#947da5','#8e6e79','#efe0d4'],
  }[region];
  const material=(color:string,options:THREE.MeshStandardMaterialParameters={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.83,...options});materials.add(m);return m;};
  const stone=material(palettes[1]),plaster=material(palettes[0]),roofMat=material(palettes[2]),wood=material(palettes[3]),trim=material(palettes[4]);
  const dark=material('#34434a'),iron=material('#506b73',{metalness:.68,roughness:.42}),gold=material('#c8a86b',{metalness:.4,roughness:.5});
  const warm=material('#f5d18f',{emissive:'#efa854',emissiveIntensity:.65}),glass=material('#6ec8d0',{emissive:'#3c9ba9',emissiveIntensity:.23,metalness:.3,roughness:.24});
  const leaves=material(region==='fairy'?'#b7a1b9':'#729873'),snow=material('#e6ece8'),ice=material('#9dcbd8',{metalness:.18,roughness:.28});
  const terracotta=material('#ba8061'),white=material('#f3ebd9'),sandstone=material('#c99367'),rockDark=material('#665e64'),flowerPink=material('#dfabc7',{emissive:'#b971a2',emissiveIntensity:.14});
  const ocean=material('#58b2be',{metalness:.28,roughness:.22,transparent:true,opacity:.86});
  const add=(parent:THREE.Object3D,geometry:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{
    geometries.add(geometry);const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const boxGeometry=new THREE.BoxGeometry(1,1,1),sphereGeometry=new THREE.SphereGeometry(1,16,12);geometries.add(boxGeometry);geometries.add(sphereGeometry);
  const box=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>add(p,boxGeometry,m,x,y,z,w,h,d);
  const ball=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>add(p,sphereGeometry,m,x,y,z,w,h,d);
  const cylinder=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,top:number,bottom:number,height:number,sides=16)=>add(p,new THREE.CylinderGeometry(top,bottom,height,sides),m,x,y,z);
  const cone=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,radius:number,height:number,sides=12)=>add(p,new THREE.ConeGeometry(radius,height,sides),m,x,y,z);
  const torus=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,r:number,tube:number,flat=false)=>{const object=add(p,new THREE.TorusGeometry(r,tube,6,36),m,x,y,z);if(flat)object.rotation.x=Math.PI/2;return object;};
  const origin=(x:number,z:number)=>{const p=new THREE.Group();p.position.set(x,getTerrainHeight(x,z),z);staticRoot.add(p);return p;};
  const roof=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
    const g=new THREE.BufferGeometry();const v=[-w/2,0,-d/2,w/2,0,-d/2,0,h,-d/2,-w/2,0,d/2,0,h,d/2,w/2,0,d/2,-w/2,0,-d/2,0,h,-d/2,0,h,d/2,-w/2,0,-d/2,0,h,d/2,-w/2,0,d/2,w/2,0,-d/2,w/2,0,d/2,0,h,d/2,w/2,0,-d/2,0,h,d/2,0,h,-d/2];g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return add(p,g,m,x,y,z);
  };
  const arch=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,depth=.8)=>{
    const r=w/2,spring=h-r,inner=r-.6,s=new THREE.Shape();s.moveTo(-r,0);s.lineTo(-r,spring);s.absarc(0,spring,r,Math.PI,0,true);s.lineTo(r,0);s.lineTo(inner,0);s.lineTo(inner,spring);s.absarc(0,spring,inner,0,Math.PI,false);s.lineTo(-inner,0);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:20});g.translate(0,0,-depth/2);return add(p,g,m,x,y,z);
  };
  const window=(p:THREE.Object3D,x:number,y:number,z:number,w=.7,h=1)=>{
    box(p,dark,x,y,z,w+.22,h+.22,.10);box(p,warm,x,y,z+.065,w,h,.07);
    box(p,trim,x,y,z+.115,.075,h+.16,.09);box(p,trim,x,y,z+.115,w+.14,.07,.09);
    box(p,trim,x,y-h/2-.14,z+.12,w+.35,.16,.3);
  };
  const house=(x:number,z:number,w:number,d:number,height:number,roofColor=roofMat)=>{
    const p=origin(x,z);box(p,stone,0,-.2,0,w+.25,.7,d+.25);box(p,plaster,0,height/2,0,w,height,d);
    for(const side of [-1,1]){box(p,wood,side*(w/2-.14),height/2,d/2+.035,.2,height,.15);box(p,wood,side*(w/2-.14),height/2,-d/2-.035,.2,height,.15);}
    box(p,wood,0,height*.55,d/2+.04,w,.16,.17);roof(p,roofColor,0,height-.03,0,w+.75,height*.62,d+.8);
    box(p,wood,0,1.03,d/2+.065,1.18,2.06,.15);box(p,dark,0,1.01,d/2+.155,.89,1.86,.06);ball(p,gold,.31,1.0,d/2+.21,.06,.06,.05);
    window(p,-w*.29,height*.62,d/2+.1);window(p,w*.29,height*.62,d/2+.1);
    if(w>5)window(p,0,height+height*.22,d/2+.2,.66,.72);
    const chimney=box(p,stone,w*.28,height+height*.4,-d*.22,.58,height*.7,.65);chimney.rotation.z=.02;
    box(p,trim,w*.28,height+height*.77,-d*.22,.78,.18,.83);
    return p;
  };
  const fence=(p:THREE.Object3D,x:number,z:number,length:number)=>{for(let i=0;i<=Math.floor(length/1.5);i++)box(p,wood,x+i*1.5,.63,z,.13,1.26,.13);box(p,wood,x+length/2,.5,z,length,.12,.13);box(p,wood,x+length/2,1.0,z,length,.12,.13);};
  const mountain=(p:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,mat:THREE.Material,whiteCap=false)=>{
    const peak=cone(p,mat,x,y+h/2,z,r,h,7);peak.rotation.y=.33;
    if(whiteCap){const cap=cone(p,snow,x,y+h*.855,z,r*.31,h*.31,7);cap.rotation.y=.33;}
  };
  const waterCanvas=document.createElement('canvas');waterCanvas.width=64;waterCanvas.height=128;const wc=waterCanvas.getContext('2d')!;
  wc.fillStyle='#84d5d8';wc.fillRect(0,0,64,128);for(let i=0;i<30;i++){wc.fillStyle=`rgba(235,255,246,${.12+(i%5)*.1})`;wc.fillRect((i*23)%64,(i*31)%128,1+i%3,10+i%23);}
  const flowTexture=new THREE.CanvasTexture(waterCanvas);flowTexture.wrapS=flowTexture.wrapT=THREE.RepeatWrapping;flowTexture.repeat.set(2,4);flowTexture.colorSpace=THREE.SRGBColorSpace;textures.push(flowTexture);
  const flowing=new THREE.MeshBasicMaterial({map:flowTexture,transparent:true,opacity:.8,side:THREE.DoubleSide});materials.add(flowing);
  const waterfall=(p:THREE.Object3D,x:number,z:number,width:number,height:number,y=0)=>{
    add(p,new THREE.PlaneGeometry(width,height,1,1),flowing,x,y+height/2,z);
    for(let i=0;i<5;i++)ball(p,white,x+(i-2)*width*.17,y+.35,z+.15,width*.25,.23,width*.34);
    const pool=add(p,new THREE.CircleGeometry(width*.92,24),ocean,x,y+.08,z+.5);pool.rotation.x=-Math.PI/2;pool.scale.y=.72;
  };

  // The outdoor sanctuary has a real façade, portico, side towers and roofline.
  const temple=origin(-8,-34);
  box(temple,stone,0,.05,0,17,.6,10.8);
  box(temple,plaster,-5.2,4.0,4.75,5.8,8,1.2);box(temple,plaster,5.2,4.0,4.75,5.8,8,1.2);
  box(temple,stone,-8,4,0,1.0,8,10);box(temple,stone,8,4,0,1,8,10);box(temple,stone,0,4,-4.8,16,8,.8);
  box(temple,dark,0,3.4,4.0,4.3,6.8,.3);arch(temple,trim,0,0,5.2,5.3,7.5,1.0);
  const templeWindow=material('#69c9bb',{emissive:'#4fb89a',emissiveIntensity:.3});
  box(temple,templeWindow,0,3.1,4.2,2.55,5.7,.12);
  for(const side of [-1,1]){
    for(const x of [3.5,6.7]){cylinder(temple,trim,side*x,3.7,5.0,.37,.48,7.4,12);box(temple,stone,side*x,.24,5,.95,.48,.95);box(temple,trim,side*x,7.25,5,1.1,.45,1.1);}
    window(temple,side*5.3,4.7,5.41,1.25,2.1);
    const tower=origin(-8+side*11,-32);box(tower,stone,0,4.5,0,3.7,9,4.4);box(tower,trim,0,8.6,0,4.0,.5,4.7);cone(tower,roofMat,0,10.1,0,2.7,2.5,4);window(tower,0,6.0,2.23,.8,1.65);
  }
  box(temple,trim,0,7.85,.2,17.3,.7,11.0);
  if(region==='water'||region==='steel'){
    const dome=add(temple,new THREE.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI/2),roofMat,0,8.2,-.6,6.3,5.0,4.6);dome.rotation.y=.15;
    cylinder(temple,gold,0,13.65,-.6,.08,.12,1.2);ball(temple,warm,0,14.3,-.6,.27,.27,.27);
  }else if(region==='fire'){
    box(temple,rockDark,0,8.35,0,16.9,.8,10.6);
    for(const side of [-1,1]){
      cone(temple,rockDark,side*4.6,10.8,-.5,3.1,5.3,4).rotation.y=Math.PI/4;
      cone(temple,iron,side*4.6,13.0,-.5,1.4,2.7,4).rotation.y=Math.PI/4;
      box(temple,gold,side*4.6,8.87,4.3,2.5,.13,.18);
    }
    const emberCrystal=material('#ffc27d',{emissive:'#ff742d',emissiveIntensity:.7,metalness:.12,roughness:.3});
    add(temple,new THREE.OctahedronGeometry(1,0),emberCrystal,0,12.45,1,1.1,2.35,1.1);
    torus(temple,gold,0,10.2,1,1.45,.10,true);
  }else if(region==='earth'){
    box(temple,sandstone,0,8.5,0,17.0,1.2,10.8);
    box(temple,trim,0,9.15,0,16.2,.18,10.1);
    box(temple,terracotta,0,9.8,-.2,13.2,1.25,7.6);
    box(temple,trim,0,10.48,-.2,13.5,.17,7.9);
    box(temple,sandstone,0,11.08,-.4,9.6,1.08,5.1);
    box(temple,trim,0,11.69,-.4,9.9,.19,5.4);
    box(temple,stone,0,12.18,-.5,5.8,.8,3.2);
    torus(temple,gold,0,12.4,2.0,1.4,.16);ball(temple,warm,0,12.4,2.03,.63,.63,.15);
    for(const side of [-1,1])box(temple,gold,side*6.5,9.75,4.95,.24,1.4,.24);
  }else if(region==='fairy'){
    ball(temple,trim,0,8.3,0,8.4,.55,5.3);
    for(let i=0;i<6;i++){
      const angle=i*Math.PI/3;
      const petal=ball(temple,i%2?flowerPink:roofMat,Math.sin(angle)*3.0,9.4+Math.cos(i)*.16,Math.cos(angle)*2.0,3.4,.55,2.0);
      petal.rotation.y=angle;petal.rotation.z=Math.sin(angle)*-.28;petal.rotation.x=Math.cos(angle)*.23;
    }
    ball(temple,flowerPink,0,10.3,0,2.3,2.4,2.3);
    const aureole=torus(temple,gold,0,13.4,0,2.3,.105,true);aureole.rotation.y=.16;
    torus(temple,templeWindow,0,13.4,0,1.92,.065,true);
    add(temple,new THREE.OctahedronGeometry(.7,0),templeWindow,0,13.45,0,.65,1.5,.65);
  }else{
    roof(temple,roofMat,0,8.05,0,18.1,3.6,11.8);roof(temple,trim,0,11.2,-.5,9.5,2.2,7.7);
    torus(temple,gold,0,11.3,5.92,1.0,.09);ball(temple,templeWindow,0,11.3,5.94,.55,.55,.13);
  }
  for(let i=0;i<7;i++)box(temple,gold,(i-3)*2.15,7.82,5.77,.35,.35,.08);

  if(region==='meadow'){
    house(-36,15,5.6,4.7,3.65);house(-25,12,4.65,4.6,3.45);house(-31,22,5.4,4.6,3.55,terracotta);
    const mill=origin(-31,6);cylinder(mill,plaster,0,5.2,0,1.6,2.45,10.4,14);cone(mill,roofMat,0,11.45,0,2.3,3.1);cylinder(mill,stone,0,.35,0,2.5,2.6,.7);
    window(mill,0,5.7,1.92,.75,1.25);box(mill,wood,0,1.1,2.4,1.3,2.2,.15);
    const rotor=new THREE.Group();rotor.position.set(0,9.4,2.4);mill.add(rotor);rotor.userData.dynamic=true;
    for(let i=0;i<4;i++){const wing=new THREE.Group();wing.rotation.z=i*Math.PI/2;rotor.add(wing);box(wing,wood,0,2.7,0,.15,5.7,.16);box(wing,white,.63,3.3,.04,1.12,3.5,.08);for(let j=0;j<5;j++)box(wing,wood,.57,1.85+j*.7,.10,1.25,.06,.11);}
    ball(rotor,gold,0,0,.15,.38,.38,.27);movers.push(time=>{rotor.rotation.z=time*.16;});
    const farm=house(18,25,6.5,5.5,4.0,terracotta);box(farm,wood,0,1.65,2.87,2.1,3.3,.22);
    const field=origin(16,16);box(field,wood,0,.01,0,9,.09,5.2);for(let row=0;row<7;row++)for(let col=0;col<12;col++){const x=-4.1+col*.74,z=-2.25+row*.7;box(field,gold,x,.34,z,.055,.63,.055);ball(field,gold,x,.71,z,.12,.25,.10);}fence(field,-4.7,-3.1,9.3);
    const falls=origin(-46,-32);box(falls,stone,0,9.0,0,12.1,18,9.4);box(falls,stone,-2,18,0,8,6,7);ball(falls,leaves,0,21.2,0,5.7,1.6,4.4);waterfall(falls,2,4.88,3.9,20);
    const bridge=origin(-41,-26);arch(bridge,trim,0,3,0,24,12,2.3);box(bridge,stone,0,15.0,0,24.2,.65,3.4);for(const side of [-1,1])box(bridge,stone,side*11.3,7,0,1.4,14,2.8);for(let i=0;i<13;i++)box(bridge,trim,-11.6+i*1.93,15.7,1.55,.16,1.1,.14);
  }
  if(region==='water'){
    const tower=origin(48,13);cylinder(tower,white,0,7.65,0,1.65,2.45,15.3,20);for(const y of [3.5,8.5,13.6])cylinder(tower,glass,0,y,0,2.43-y*.05,2.45-y*.05,.43,20);
    cylinder(tower,trim,0,15.5,0,2.7,2.7,.5);cylinder(tower,glass,0,16.65,0,1.45,1.45,1.8);for(let i=0;i<8;i++){const a=i*Math.PI/4;box(tower,gold,Math.sin(a)*1.52,16.7,Math.cos(a)*1.52,.13,2,.13);}cone(tower,roofMat,0,18.4,0,2.2,2.0);ball(tower,warm,0,16.7,0,.6,.9,.6);
    box(tower,dark,0,1.2,2.39,1.15,2.4,.15);house(54,22,5.8,4.8,4.05);house(42,26,5.0,3.9,3.5);
    const quay=origin(42,18);for(let i=0;i<9;i++)box(quay,wood,-5+i*.62,-.12,-5, .54,.16,5.5);for(const x of [-5,0])for(const z of [-7.5,-2.5])cylinder(quay,wood,x,-.5,z,.12,.15,1.5);
    const ship=new THREE.Group();ship.position.set(35,.74,1);ship.rotation.y=-.45;staticRoot.add(ship);ball(ship,wood,0,.6,0,1.4,.65,3.2);box(ship,wood,0,1.02,0,2.2,.2,5.6);cylinder(ship,wood,0,4.4,0,.08,.15,7.6);box(ship,wood,0,7.5,0,4.0,.12,.12);
    const sail=new THREE.BufferGeometry();sail.setAttribute('position',new THREE.Float32BufferAttribute([-.08,7.4,0,-.08,2.0,0,3.6,2.2,.25,.08,7.4,0,-3,2.4,.25,.08,2.0,0],3));sail.computeVertexNormals();const sailMat=material('#f4eee0',{side:THREE.DoubleSide});add(ship,sail,sailMat);
    const arcade=origin(-30,7);box(arcade,plaster,0,3.4,0,13.8,6.8,2.7);box(arcade,trim,0,7.0,0,14.2,.5,3.1);
    for(const x of [-5.8,0,5.8])arch(arcade,white,x,0,3,5.5,7.5,1.4);for(const side of [-1,1])box(arcade,plaster,side*6,3.5,2.5,2.0,7,5.2);
    const cascades=origin(-44,-39);for(let i=0;i<3;i++){box(cascades,plaster,(i-1)*2.0,4+i*6, -i*1.4,12-i*2,8+i*4,9-i*1.5);waterfall(cascades,(i-1)*1.8,4.5-i*.3,3.5-i*.6,8+i*7);}ball(cascades,leaves,-2,25,0,4.5,1.4,3.6);
  }
  if(region==='fire'){
    const glacier=origin(-46,-13);mountain(glacier,0,0,0,8,28,rockDark,true);mountain(glacier,-4,0,4,4.7,18,snow,true);mountain(glacier,5,0,-1,3.4,22,ice,true);
    for(let i=0;i<5;i++){const shelf=box(glacier,ice,(i-2)*1.3,1.9+i*.35,6.5,1.6,3.6,2.6);shelf.rotation.z=(i-2)*.08;}
    const spire=origin(-40,0);mountain(spire,0,0,0,3.3,16,ice,true);mountain(spire,1.6,0,1.2,1.4,9,snow);
    const mountainBackdrop=origin(-99,-100);mountain(mountainBackdrop,0,0,0,20,58,stone,true);mountain(mountainBackdrop,26,0,-18,19,48,stone,true);
    const spring=origin(18,18);cylinder(spring,stone,0,.24,0,4.5,4.6,.7,28);cylinder(spring,ocean,0,.62,0,3.75,3.75,.09,28);for(let i=0;i<12;i++){const a=i*Math.PI/6;ball(spring,rockDark,Math.sin(a)*4.1,.8,Math.cos(a)*3.2,.65,.55,.55);}spring.scale.z=.78;
    const steamMat=material('#eee7e1',{transparent:true,opacity:.19,depthWrite:false});const steam=new THREE.Group();spring.add(steam);steam.userData.dynamic=true;for(let i=0;i<6;i++)ball(steam,steamMat,Math.sin(i*2.1)*2,1.5+i*.45,Math.cos(i*2.1)*1.5,.7,.3,.7);movers.push(t=>{steam.position.y=getTerrainHeight(18,18)+Math.sin(t*.5)*.22;steam.rotation.y=t*.045;});
    house(22,27,6.7,5.3,4.1);const watch=origin(12,-27);box(watch,rockDark,0,5.7,0,6.0,11.4,6.0);box(watch,stone,0,12.0,0,6.5,1,6.5);for(const side of [-1,1])for(const axis of [-1,1])box(watch,trim,side*2.3,14.1,axis*2.3,.5,4.0,.5);roof(watch,stone,0,16,0,6.6,1.5,6.6);window(watch,0,6,3.03,1.2,3.2);box(watch,dark,0,1.5,3.05,1.8,3,.15);
  }
  if(region==='earth'){
    const cliff=origin(-47,-6);for(let i=0;i<7;i++){box(cliff,i%2?terracotta:sandstone,0,1.6+i*3.0,-i*.35,13.6-i*.75,3.0,15.5-i*.7);for(const side of [-1,1])box(cliff,stone,side*(6-i*.23),2+i*3,4.4-i*.15,.45,2.6,5.0);}
    for(let i=0;i<5;i++){const x=(i-2)*2.4;box(cliff,dark,x,3.2+(i%2)*6,7.81,1.5,2.8,.15);arch(cliff,trim,x,1.8+(i%2)*6,7.95,2.1,3.4,.35);box(cliff,sandstone,x,1.6+(i%2)*6,8.0,2.7,.3,.65);}
    house(-41,13,5.9,5.0,4.1,sandstone);
    for(const [x,z,r,h] of [[-47,-36,4.4,19],[-25,-37,2.9,16]]){const pillar=origin(x,z);for(let i=0;i<7;i++)cylinder(pillar,i%2?terracotta:sandstone,0,(i+.5)*h/7,0,r*(1-i*.035),r*(1-i*.025),h/7,9);}
    const bridge=origin(-36,-36);arch(bridge,trim,0,3.4,0,22,12,2.5);box(bridge,sandstone,0,15.3,0,24.2,.6,3.2);for(let i=0;i<13;i++)box(bridge,trim,-11.5+i*1.92,16.0,1.45,.13,1.0,.12);
    const oasis=origin(18,17);cylinder(oasis,trim,0,.28,0,4.7,4.8,.6,24);cylinder(oasis,ocean,0,.62,0,3.9,3.9,.08,24);oasis.scale.z=.82;for(let i=0;i<7;i++){const a=i/7*Math.PI*2;cylinder(oasis,plaster,Math.sin(a)*4.2,1.15,Math.cos(a)*4.2,.18,.24,2.3,9);}
    const ruin=origin(23,26);box(ruin,sandstone,0,2.6,-1.5,7.2,5.2,1.3);for(const x of [-3,0,3]){cylinder(ruin,trim,x,3.2,1.8,.33,.45,6.4,10);box(ruin,trim,x,6.4,1.8,1.15,.45,1.1);}box(ruin,sandstone,0,6.7,1.8,7.4,.6,1.1);
  }
  if(region==='steel'){
    const observatory=origin(-30,9);cylinder(observatory,stone,0,3.2,0,6.05,6.2,6.4,20);cylinder(observatory,trim,0,6.5,0,6.4,6.4,.4,28);add(observatory,new THREE.SphereGeometry(1,28,16,0,Math.PI*2,0,Math.PI/2),roofMat,0,6.7,0,6.2,6.5,6.2);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;box(observatory,gold,Math.sin(a)*5.8,3.25,Math.cos(a)*5.8,.18,6.5,.18);}box(observatory,dark,0,1.8,6.06,2.1,3.6,.15);arch(observatory,trim,0,0,6.18,3.1,4.8,.5);
    const scope=new THREE.Group();scope.position.set(0,12.9,-1.1);scope.rotation.x=-.48;observatory.add(scope);cylinder(scope,iron,0,1.2,0,.8,1,5.7,16);cylinder(scope,gold,0,4.2,0,.95,.95,.2,16);cylinder(scope,glass,0,4.33,0,.77,.77,.05,20);
    house(-40,14,5.8,5.0,4.1,iron);
    const aqueduct=origin(12,-11);for(const z of [-13,1,14]){box(aqueduct,stone,0,5.8,z,2.5,11.6,4.25);box(aqueduct,trim,0,1.0,z,2.75,1.2,4.5);}box(aqueduct,stone,0,12.0,0,3.7,.8,31.6);for(const side of [-1,1])box(aqueduct,trim,side*1.7,13.0,0,.3,1.6,31.6);box(aqueduct,glass,0,12.5,0,2.8,.08,31.5);
    for(const z of [-6,7]){const a=arch(aqueduct,trim,0,3,z,12.5,9,1.2);a.rotation.y=Math.PI/2;}
    const workshop=origin(49,17);box(workshop,stone,0,3.7,0,9.7,7.4,8.0);roof(workshop,iron,0,7.35,0,10.1,2.4,8.5);for(const x of [-3,0,3])window(workshop,x,4.8,4.05,1.4,2.0);box(workshop,dark,0,1.8,4.07,2.7,3.6,.1);const stack=origin(56,17);cylinder(stack,iron,0,7.4,0,1.2,1.4,14.8,12);torus(stack,gold,0,14.4,0,1.3,.15,true);
    const gear=new THREE.Group();gear.position.set(-4.8,4.0,4.35);workshop.add(gear);gear.userData.dynamic=true;torus(gear,gold,0,0,0,2.1,.23);for(let i=0;i<14;i++){const a=i/14*Math.PI*2;const tooth=box(gear,gold,Math.sin(a)*2.2,Math.cos(a)*2.2,0,.45,.6,.4);tooth.rotation.z=-a;}for(let i=0;i<6;i++){const beam=box(gear,iron,0,0,0,.2,4.0,.25);beam.rotation.z=i*Math.PI/3;}movers.push(t=>{gear.rotation.z=t*.06;});
  }
  if(region==='fairy'){
    const tree=origin(-30,8);cylinder(tree,wood,0,7.7,0,1.7,3.1,15.4,12);for(let i=0;i<7;i++){const a=i*2.4;const branch=cylinder(tree,wood,Math.sin(a)*2.4,13+Math.sin(i)*2,Math.cos(a)*2.4,.3,.85,7.0,8);branch.rotation.z=Math.sin(a)*.8;branch.rotation.x=Math.cos(a)*.8;ball(tree,leaves,Math.sin(a)*4.4,18.7+Math.sin(i*1.8)*1.9,Math.cos(a)*4.0,4.8,3.8,4.6);}
    const deck=cylinder(tree,wood,0,8.7,0,6.6,6.6,.4,20);deck.rotation.y=.12;
    for(const side of [-1,1]){box(tree,plaster,side*4.1,10.6,.7,3.6,3.7,3.8);roof(tree,roofMat,side*4.1,12.4,.7,4.5,2.3,4.8);window(tree,side*4.1,10.9,2.65,.9,1.3);}
    for(let i=0;i<16;i++){const a=i*Math.PI/8;cylinder(tree,wood,Math.sin(a)*6.2,9.3,Math.cos(a)*6.2,.06,.07,1.2,6);ball(tree,warm,Math.sin(a)*6.1,10.1,Math.cos(a)*6.1,.16,.23,.16);}house(-38,16,4.3,4.3,3.4);
    const mushroom=(x:number,z:number,r:number,h:number,color:THREE.Material)=>{const p=origin(x,z);cylinder(p,plaster,0,h*.37,0,r*.51,r*.62,h*.74,18);add(p,new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),color,0,h*.67,0,r,h*.32,r);cylinder(p,trim,0,h*.67,0,r,r,.13,24);box(p,dark,0,1.1,r*.6,1.0,2.2,.12);arch(p,wood,0,0,r*.66,1.5,2.65,.2);window(p,-r*.31,h*.42,r*.57,.55,.8);for(let i=0;i<8;i++){const a=i*2.4;ball(p,white,Math.sin(a)*r*.67,h*.86+Math.cos(i)*h*.035,Math.cos(a)*r*.67,.25,.075,.25);}};
    mushroom(18,18,2.6,7.2,flowerPink);mushroom(10,19,2.05,5.3,roofMat);mushroom(22,27,2.7,7.7,terracotta);
    const garden=origin(-43,-32);for(const [x,z,w,h] of [[-5,-1,3.1,16],[5,-1,2.4,12]])mountain(garden,x,0,z,w,h,stone);
    const floating=new THREE.Group();floating.position.y=15.6;garden.add(floating);floating.userData.dynamic=true;
    for(let i=0;i<4;i++){const x=(i-1.5)*4.1,y=Math.sin(i*1.7)*2,z=Math.cos(i)*2;const rock=cone(floating,stone,x,y,z,2.5,4,6);rock.rotation.z=Math.PI;ball(floating,leaves,x,y+2,z,2.5,.5,2.1);ball(floating,flowerPink,x,y+2.6,z,.9,.65,.85);}movers.push(t=>{floating.position.y=getTerrainHeight(-43,-32)+15.6+Math.sin(t*.5)*.3;});
    const gateway=origin(-36,-25);arch(gateway,trim,0,0,0,5.8,8.7,.85);for(const side of [-1,1])for(let i=0;i<8;i++)ball(gateway,flowerPink,side*(2.5-i*.08),i*.85, .45,.3,.24,.25);
  }

  // Move animated parts out of the static tree before merging everything else.
  staticRoot.updateMatrixWorld(true);
  const dynamic:THREE.Object3D[]=[];staticRoot.traverse(object=>{if(object.userData.dynamic)dynamic.push(object);});
  for(const object of dynamic)group.attach(object);
  staticRoot.updateMatrixWorld(true);
  const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
  staticRoot.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||Array.isArray(object.material))return;
    const geometry=object.geometry.clone();geometry.applyMatrix4(object.matrixWorld);geometry.deleteAttribute('uv1');
    if(!geometry.hasAttribute('uv'))geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
    const expanded=geometry.index?geometry.toNonIndexed():geometry;if(expanded!==geometry)geometry.dispose();
    const bucket=buckets.get(object.material)??[];bucket.push(expanded);buckets.set(object.material,bucket);
  });
  for(const [mat,parts] of buckets){
    const geometry=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());
    if(geometry){geometries.add(geometry);const batch=new THREE.Mesh(geometry,mat);batch.castShadow=mat!==flowing;batch.receiveShadow=true;group.add(batch);}
  }
  group.remove(staticRoot);staticRoot.clear();
  return {
    group,
    update(time:number,visited=false){movers.forEach(move=>move(time));flowTexture.offset.y=-time*.35;templeWindow.emissiveIntensity=visited?.7:.27;},
    dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear();},
  };
}
