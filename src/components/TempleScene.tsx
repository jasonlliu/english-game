import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { ArrowLeft, Check, Compass, Gem, Sparkles } from 'lucide-react';
import { createHero, createPet, type ModelRig } from './adventureModels';
import type { PetId, RegionId } from '../game/adventure';
import { activateTempleSeal, TEMPLE_THEMES } from '../game/temple';
import { getTemplePath, resolveTempleMovement, TEMPLE_COLUMNS, TEMPLE_SEALS, TEMPLE_SPAWN, TEMPLE_TARGETS } from '../game/templeWorld';
import type { WorldPoint } from '../game/world';

interface Props {
  region: RegionId; stage: 0|1|2|3; companionId: PetId|null; paused: boolean;
  completed: boolean; onComplete(): void; onExit(): void;
}
const palettes:Record<RegionId,{stone:string;floor:string;trim:string;glow:string;sky:string}>={
  meadow:{stone:'#b6bb9c',floor:'#84958a',trim:'#ead399',glow:'#f9dc8c',sky:'#dce6c7'},
  water:{stone:'#a1c7ce',floor:'#4e7e91',trim:'#dae8d9',glow:'#8de7f2',sky:'#bfe9ee'},
  fire:{stone:'#776d79',floor:'#514d63',trim:'#eac0a0',glow:'#ffae73',sky:'#e2cfe6'},
  earth:{stone:'#bc9b71',floor:'#7e7861',trim:'#f0d398',glow:'#d8e896',sky:'#e9d9b4'},
  steel:{stone:'#8c9baa',floor:'#53677e',trim:'#d7bb83',glow:'#a8e8fc',sky:'#d4e3ed'},
  fairy:{stone:'#baa8c7',floor:'#756889',trim:'#edc4cc',glow:'#edb5ff',sky:'#e9d5f3'},
};

export default function TempleScene(props:Props){
  const host=useRef<HTMLDivElement>(null), latest=useRef(props);latest.current=props;
  const theme=TEMPLE_THEMES[props.region];
  const [sequence,setSequence]=useState<number[]>(props.completed?[...theme.order]:[]);
  const sequenceRef=useRef(sequence);sequenceRef.current=sequence;
  const [near,setNear]=useState<number|null>(null), nearRef=useRef<number|null>(null);
  const [message,setMessage]=useState(props.completed?'旧日的灯火仍为你亮着。可以自由重访。':'循着碑文的顺序，靠近三座光印并按 E 点亮。');
  const [collapsed,setCollapsed]=useState(false);
  const navigateRef=useRef<(id:number)=>void>(()=>{}), interactRef=useRef<()=>void>(()=>{});
  const joystick=useRef({x:0,z:0}), stickRef=useRef<HTMLSpanElement>(null);
  interactRef.current=()=>{
    if(latest.current.paused)return;
    const id=nearRef.current;if(id===null)return;
    if(id===4){latest.current.onExit();return;}
    if(id===3){if(sequenceRef.current.length===3){if(!latest.current.completed)latest.current.onComplete();else setMessage('这件遗物已收入收藏，灯火会记得你的来访。');}else setMessage('遗物被光幕守护。先依照碑文点亮三座光印。');return;}
    const result=activateTempleSeal(sequenceRef.current,id,theme.order);
    sequenceRef.current=result.sequence;setSequence(result.sequence);
    setMessage(result.solved?'光幕消散了！走到殿堂深处，领取遗物。':result.correct?`${theme.sealNames[id]}已亮起。${theme.clue}`:'光印熄灭了。没有损失，按碑文顺序再试一次。');
  };
  useEffect(()=>{
    const element=host.current;if(!element)return;
    const palette=palettes[props.region];
    const scene=new THREE.Scene();scene.background=new THREE.Color(palette.sky);scene.fog=new THREE.Fog(palette.sky,35,65);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;element.appendChild(renderer.domElement);
    const camera=new THREE.PerspectiveCamera(52,1,.1,100);
    scene.add(new THREE.HemisphereLight(palette.sky,'#414653',2.8));
    const sun=new THREE.DirectionalLight('#fff0d4',3.4);sun.position.set(-7,20,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-18,right:18,top:22,bottom:-22,near:1,far:65});sun.shadow.bias=-.001;scene.add(sun);
    const resourcesG=new Set<THREE.BufferGeometry>(),resourcesM=new Set<THREE.Material>();
    const mat=(color:string,options:THREE.MeshStandardMaterialParameters={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.78,...options});resourcesM.add(m);return m;};
    const stone=mat(palette.stone),floorMat=mat(palette.floor),trim=mat(palette.trim,{metalness:.35,roughness:.42}),dark=mat('#354052'),light=mat(palette.glow,{emissive:palette.glow,emissiveIntensity:1.5}),glass=mat(palette.glow,{transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}),plant=mat(props.region==='fairy'?'#a290b2':'#6c957f');
    const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=scene)=>{resourcesG.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    const box=(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number,parent?:THREE.Object3D)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
    const cylinder=(r:number,h:number,m:THREE.Material,x:number,y:number,z:number,rt=r,segments=12,parent?:THREE.Object3D)=>add(new THREE.CylinderGeometry(rt,r,h,segments),m,x,y,z,parent);
    const ring=(r:number,t:number,m:THREE.Material,x:number,y:number,z:number,parent?:THREE.Object3D)=>add(new THREE.TorusGeometry(r,t,6,44),m,x,y,z,parent);
    box(26,.45,34,stone,0,-.25,0);box(26,.7,2,stone,0,-.45,16);
    const tilesGeometry=new THREE.BoxGeometry(1.93,.05,1.93);resourcesG.add(tilesGeometry);
    const tiles=new THREE.InstancedMesh(tilesGeometry,floorMat,13*17);let tileId=0;const dummy=new THREE.Object3D();
    for(let x=-12;x<=12;x+=2)for(let z=-16;z<=16;z+=2){dummy.position.set(x,.01,z);dummy.updateMatrix();tiles.setMatrixAt(tileId,dummy.matrix);tiles.setColorAt(tileId++,new THREE.Color(palette.floor).multiplyScalar(.88+((x*z+x+z+100)%7)*.026));}tiles.receiveShadow=true;scene.add(tiles);
    box(3.1,.06,25,trim,0,.05,-.5);box(2.85,.08,25,floorMat,0,.07,-.5);
    for(let z=-12;z<=10;z+=2){const mosaic=box(.75,.02,.75,trim,0,.12,z);mosaic.rotation.y=Math.PI/4;}
    // Open clerestories keep the camera inside the architecture without hiding the adventurer.
    for(const side of [-1,1]){
      box(.9,3,33,stone,side*12.1,1.5,0);box(1.1,.18,33,trim,side*12.1,3.1,0);
      for(let z=-13;z<=12;z+=5){box(.7,5,.7,stone,side*12.1,5.6,z);box(.9,.18,4.8,trim,side*12.1,7.9,z+2.3);const pane=box(.04,3,3.2,glass,side*12.1,5.4,z+2.3);pane.castShadow=false;}
      box(.8,.12,27,light,side*11.25,.15,-.5);
    }
    box(26,7,.8,stone,0,3.5,-16.7);
    box(6,5,.1,dark,0,3,-16.22);
    const windowRing=ring(3,.18,trim,0,7,-16.25);windowRing.scale.y=1.2;
    const windowDisc=add(new THREE.CircleGeometry(2.8,40),glass,0,7,-16.3);windowDisc.scale.y=1.2;
    for(let i=0;i<8;i++){const spoke=box(.11,5.6,.12,trim,0,7,-16.15);spoke.rotation.z=i*Math.PI/8;}
    for(const c of TEMPLE_COLUMNS){
      cylinder(1.25,.3,stone,c.x,.15,c.z);cylinder(1.05,.3,trim,c.x,.4,c.z);cylinder(.72,6.7,stone,c.x,3.9,c.z,.64);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;cylinder(.065,6,trim,c.x+Math.cos(a)*.71,3.8,c.z+Math.sin(a)*.71,.065,5);}
      cylinder(1.1,.25,trim,c.x,7.25,c.z);box(2.3,.6,2.3,stone,c.x,7.65,c.z);
      const curve=new THREE.EllipseCurve(0,0,9,4,0,Math.PI,false,0);const points=curve.getPoints(35).map(p=>new THREE.Vector3(p.x,p.y+7.9,c.z));
      if(c.x<0){add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,.18,6,false),stone,0,0,0);box(1.7,.18,1.7,trim,0,11.75,c.z);}
    }
    // Entry portal, side alcoves and themed gardens.
    for(const x of [-4,4]){box(1,6,1.2,stone,x,3,15.6);box(1.4,.25,1.6,trim,x,6.1,15.6);}box(9,.65,1.4,stone,0,6.6,15.6);
    const entryGlow=box(6,4.8,.05,glass,0,2.5,15.8);entryGlow.castShadow=false;
    for(const x of [-10.7,10.7])for(const z of [-12,4,12]){
      cylinder(.65,.8,stone,x,.4,z);const bowl=cylinder(.8,.3,trim,x,.95,z,.95);
      if(props.region==='fire'||props.region==='steel'){
        add(new THREE.OctahedronGeometry(.65,0),light,x,1.5,z);const torch=new THREE.PointLight(palette.glow,7,7);torch.position.set(x,2,z);scene.add(torch);
      }else{
        for(let i=0;i<5;i++){const leaf=add(new THREE.SphereGeometry(1,7,5),plant,x+Math.sin(i*2.4)*.4,1.5+Math.cos(i)*.2,z+Math.cos(i*2.4)*.4);leaf.scale.set(.25,.9,.2);leaf.rotation.z=Math.sin(i)*.5;}
      }
      bowl.receiveShadow=true;
    }
    const lampOrbs:THREE.Mesh[]=[],lampRings:THREE.Mesh[]=[],lampLights:THREE.PointLight[]=[];
    TEMPLE_SEALS.forEach((p,i)=>{
      cylinder(1.1,.25,stone,p.x,.18,p.z);cylinder(.8,.2,trim,p.x,.4,p.z);cylinder(.55,1.5,stone,p.x,1.1,p.z,.72);
      const halo=ring(.77,.035,trim,p.x,2.6,p.z);lampRings.push(halo);
      const orbMaterial=mat(palette.glow,{emissive:palette.glow,emissiveIntensity:.15,metalness:.3,roughness:.28});
      const orb=add(new THREE.OctahedronGeometry(.45,1),orbMaterial,p.x,2.5,p.z);lampOrbs.push(orb);
      const lampLight=new THREE.PointLight(palette.glow,0,7);lampLight.position.set(p.x,3,p.z);scene.add(lampLight);lampLights.push(lampLight);
      // Distinct silhouettes make the three glyphs recognizable from a distance.
      for(let j=0;j<=i;j++){const rune=box(.17,.7,.14,trim,p.x+(j-i/2)*.28,1.3,p.z+.65);rune.rotation.z=.15*(j-i/2);}
    });
    cylinder(1.9,.2,stone,0,.18,-13);cylinder(1.55,.4,trim,0,.48,-13);cylinder(1.1,1,stone,0,1.1,-13,1.25);
    const artifact=new THREE.Group();artifact.position.set(0,2.8,-13);scene.add(artifact);
    add(new THREE.IcosahedronGeometry(.62,0),light,0,0,0,artifact);
    for(let i=0;i<3;i++){const r=ring(.95,.045,trim,0,0,0,artifact);r.rotation.x=i*Math.PI/3;r.rotation.y=i*.8;}
    const aura=add(new THREE.CylinderGeometry(1.8,1.8,4.6,40,1,true),glass,0,2.5,-13);aura.castShadow=false;
    const gate=new THREE.Group();gate.position.set(0,3.6,-10.9);scene.add(gate);
    const gateMaterial=mat(palette.glow,{transparent:true,opacity:.25,emissive:palette.glow,emissiveIntensity:.5,depthWrite:false});
    const curtain=box(5.4,6.8,.04,gateMaterial,0,0,0,gate);curtain.castShadow=false;
    for(let x=-2.4;x<=2.5;x+=.8){const line=box(.03,6.7,.03,light,x,0,0,gate);line.castShadow=false;}
    const beam=add(new THREE.ConeGeometry(4,13,32,1,true),glass,0,6.8,-13);beam.castShadow=false;
    const particlesGeometry=new THREE.BufferGeometry(),particlesArray=new Float32Array(90*3);
    for(let i=0;i<90;i++){particlesArray[i*3]=Math.sin(i*7.31)*11;particlesArray[i*3+1]=.6+(i%17)*.45;particlesArray[i*3+2]=Math.cos(i*3.82)*15;}
    particlesGeometry.setAttribute('position',new THREE.BufferAttribute(particlesArray,3));resourcesG.add(particlesGeometry);const particlesMaterial=new THREE.PointsMaterial({color:palette.glow,size:.055,transparent:true,opacity:.7,depthWrite:false});resourcesM.add(particlesMaterial);scene.add(new THREE.Points(particlesGeometry,particlesMaterial));
    const cameraBlockers:THREE.Object3D[]=[];scene.traverse(node=>{if(node instanceof THREE.Mesh&&!(node.material as THREE.Material).transparent)cameraBlockers.push(node);});
    const hero=createHero();scene.add(hero.group);let companion:ModelRig|null=null,petKey='';
    const player={...TEMPLE_SPAWN},follower={x:-2,z:12};let heading=0,yaw=0,pitch=.3,jump=0,vy=0,time=0;
    let path:WorldPoint[]=[],keys=new Set<string>(),drag:{x:number;y:number;startX:number;startY:number;id:number}|null=null;
    let followerPath:WorldPoint[]=[],followerRepathAt=0;
    const clickTarget=ring(.6,.035,light,0,.16,0);clickTarget.rotation.x=-Math.PI/2;clickTarget.visible=false;
    const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
    navigateRef.current=(id)=>{if(latest.current.paused)return;path=getTemplePath(player,TEMPLE_TARGETS[id]);if(path.length){clickTarget.position.set(TEMPLE_TARGETS[id].x,.16,TEMPLE_TARGETS[id].z);clickTarget.visible=true;setMessage(id<3?`正在前往${theme.sealNames[id]}光印，靠近后按 E 或点击交互按钮。`:id===3?'正在前往殿堂深处的遗物。':'正在返回殿门。');}};
    const clear=()=>{keys.clear();joystick.current={x:0,z:0};if(stickRef.current)stickRef.current.style.transform='translate(0,0)';drag=null;};
    const keyDown=(e:KeyboardEvent)=>{if(latest.current.paused)return;if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;if(e.code==='Space'&&(e.target as HTMLElement)?.closest('button,a'))return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','KeyF'].includes(e.code))e.preventDefault();keys.add(e.code);
      if(e.code==='KeyE'&&!e.repeat)interactRef.current();if(e.code==='KeyF'&&!e.repeat)setMessage('殿堂内步行探索，回到旷野后就能骑乘飞行。');};
    const keyUp=(e:KeyboardEvent)=>keys.delete(e.code);
    const down=(e:PointerEvent)=>{if(latest.current.paused)return;drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);};
    const move=(e:PointerEvent)=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.005;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-drag.y)*.003,.25,.95);drag.x=e.clientX;drag.y=e.clientY;};
    const up=(e:PointerEvent)=>{if(!drag)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6&&!latest.current.paused){const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);if(ray.ray.intersectPlane(plane,hit)){path=getTemplePath(player,{x:hit.x,z:hit.z});if(path.length){clickTarget.position.set(hit.x,.16,hit.z);clickTarget.visible=true;}}}drag=null;};
    const wheel=(e:WheelEvent)=>{e.preventDefault();if(latest.current.paused)return;pitch=THREE.MathUtils.clamp(pitch+e.deltaY*.0006,.25,.95);};
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',clear);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clear);
    const resize=()=>{const w=element.clientWidth,h=element.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(element);resize();
    let frame=0,last=performance.now(),lastNear:number|null=null;
    const targetCamera=new THREE.Vector3(),look=new THREE.Vector3(),cameraRay=new THREE.Raycaster(),cameraDirection=new THREE.Vector3();camera.position.set(0,8,19);
    const animate=(now:number)=>{frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.035);last=now;
      const paused=latest.current.paused;if(paused){clear();}else time+=dt;
      const newKey=`${latest.current.companionId}-${latest.current.stage}`;if(newKey!==petKey){if(companion){scene.remove(companion.group);companion.dispose();}companion=latest.current.companionId?createPet(latest.current.companionId,latest.current.stage):null;if(companion)scene.add(companion.group);petKey=newKey;}
      let dx=0,dz=0;if(!paused){const lx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+joystick.current.x;const lz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+joystick.current.z;
        if(Math.hypot(lx,lz)>.08){path=[];clickTarget.visible=false;dx=lx*Math.cos(yaw)+lz*Math.sin(yaw);dz=-lx*Math.sin(yaw)+lz*Math.cos(yaw);}else if(path.length){const target=path[0],dist=Math.hypot(target.x-player.x,target.z-player.z);if(dist<.25){path.shift();if(!path.length)clickTarget.visible=false;}else{dx=(target.x-player.x)/dist;dz=(target.z-player.z)/dist;}}
      }
      const magnitude=Math.hypot(dx,dz);if(magnitude>1){dx/=magnitude;dz/=magnitude;}const next=resolveTempleMovement(player,{x:player.x+dx*5.5*dt,z:player.z+dz*5.5*dt});const moving=Math.hypot(next.x-player.x,next.z-player.z)/dt;Object.assign(player,next);
      if(moving>.1){const angle=Math.atan2(-dx,-dz);heading+=Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading))*Math.min(1,dt*12);}
      if(!paused){if(keys.has('Space')&&jump===0)vy=5.3;vy-=14*dt;jump=Math.max(0,jump+vy*dt);if(jump===0)vy=0;}
      hero.animate(time,Math.min(moving/5.5,1),jump);hero.group.position.set(player.x,.14+jump,player.z);hero.group.rotation.y=heading;
      if(companion){
        let followerSpeed=0;
        if(!paused){
          const dist=Math.hypot(player.x-follower.x,player.z-follower.z);
          if(dist>2.4){
            // Reuse a safe route between modest refreshes instead of pushing into pillars.
            if(time>=followerRepathAt){followerPath=getTemplePath(follower,player);followerRepathAt=time+.6;}
            while(followerPath.length&&Math.hypot(followerPath[0].x-follower.x,followerPath[0].z-follower.z)<.12)followerPath.shift();
            const target=followerPath[0];
            if(target){
              const distance=Math.hypot(target.x-follower.x,target.z-follower.z),step=Math.min(distance,Math.min(7,dist*1.8)*dt);
              const nextFollower=resolveTempleMovement(follower,{x:follower.x+(target.x-follower.x)/distance*step,z:follower.z+(target.z-follower.z)/distance*step});
              const movedX=nextFollower.x-follower.x,movedZ=nextFollower.z-follower.z;
              followerSpeed=Math.hypot(movedX,movedZ)/Math.max(dt,.001);Object.assign(follower,nextFollower);
              if(followerSpeed>.05)companion.group.rotation.y=Math.atan2(-movedX,-movedZ);
            }
          }else{followerPath=[];followerRepathAt=0;}
        }
        companion.group.position.set(follower.x,.14,follower.z);companion.animate(time,Math.min(followerSpeed/7,1));
      }
      const nearIndex=TEMPLE_TARGETS.map((p,i)=>({i,d:Math.hypot(player.x-p.x,player.z-p.z)})).filter(p=>p.d<2.15).sort((a,b)=>a.d-b.d)[0]?.i??null;
      if(nearIndex!==lastNear){lastNear=nearIndex;nearRef.current=nearIndex;setNear(nearIndex);}
      lampOrbs.forEach((orb,i)=>{const lit=sequenceRef.current.includes(i);const m=orb.material as THREE.MeshStandardMaterial;m.emissiveIntensity=lit?2:.08;orb.position.y=2.5+Math.sin(time*1.5+i)*.13;orb.rotation.y=time*.5;lampRings[i].rotation.y=Math.sin(time*.5+i)*.4;lampLights[i].intensity=lit?8:0;});
      gate.scale.y=THREE.MathUtils.lerp(gate.scale.y,sequenceRef.current.length===3?.001:1,Math.min(1,dt*2));gate.position.y=6.9-gate.scale.y*3.3;gate.visible=gate.scale.y>.01;
      artifact.rotation.y=time*.4;artifact.position.y=2.8+Math.sin(time*1.3)*.16;artifact.visible=!latest.current.completed;aura.visible=!latest.current.completed;beam.visible=sequenceRef.current.length===3;
      targetCamera.set(player.x+Math.sin(yaw)*10*Math.cos(pitch),2.8+Math.sin(pitch)*8,player.z+Math.cos(yaw)*10*Math.cos(pitch));targetCamera.x=THREE.MathUtils.clamp(targetCamera.x,-10.8,10.8);targetCamera.z=THREE.MathUtils.clamp(targetCamera.z,-14.8,18);look.set(player.x,1.7,player.z-.2);cameraDirection.subVectors(targetCamera,look);const cameraDistance=cameraDirection.length();cameraRay.set(look,cameraDirection.normalize());cameraRay.far=cameraDistance;const obstruction=cameraRay.intersectObjects(cameraBlockers,false)[0];if(obstruction&&obstruction.distance<cameraDistance)targetCamera.copy(look).addScaledVector(cameraDirection,Math.max(1.3,obstruction.distance-.3));camera.position.lerp(targetCamera,1-Math.exp(-dt*7));camera.lookAt(look);renderer.render(scene,camera);
    };frame=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clear);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',clear);renderer.domElement.removeEventListener('wheel',wheel);hero.dispose();companion?.dispose();resourcesG.forEach(g=>g.dispose());resourcesM.forEach(m=>m.dispose());sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();navigateRef.current=()=>{};};
  },[props.region]);
  useEffect(()=>{if(props.completed){sequenceRef.current=[...theme.order];setSequence([...theme.order]);}},[props.completed,theme]);
  const moveStick=(event:React.PointerEvent<HTMLDivElement>)=>{const r=event.currentTarget.getBoundingClientRect(),x=event.clientX-r.left-r.width/2,z=event.clientY-r.top-r.height/2,scale=Math.max(1,Math.hypot(x,z)/32);joystick.current={x:x/scale/32,z:z/scale/32};if(stickRef.current)stickRef.current.style.transform=`translate(${x/scale}px,${z/scale}px)`;};
  const resetStick=()=>{joystick.current={x:0,z:0};if(stickRef.current)stickRef.current.style.transform='translate(0,0)';};
  const label=near===null?'':near===4?'走出神庙':near===3?(props.completed?'查看遗物碑文':sequence.length===3?'领取神庙遗物':'查看封印'):sequence.includes(near)?`${theme.sealNames[near]}已点亮`:`点亮${theme.sealNames[near]}`;
  return <div className="temple-scene" style={{'--temple-accent':theme.color} as CSSProperties}>
    <div className="temple-canvas" ref={host}/>
    <section className={`temple-objective ${collapsed?'collapsed':''}`}><button className="temple-heading" onClick={()=>setCollapsed(!collapsed)} aria-expanded={!collapsed}><span><small>HIDDEN SANCTUARY · 秘境探索</small><strong>{theme.name}</strong></span><b>{props.completed?<Check size={18}/>: `${sequence.length} / 3`}</b></button>{!collapsed&&<><p>{theme.clue}</p><div className="temple-lamps">{theme.sealNames.map((name,id)=><button key={name} onClick={()=>navigateRef.current(id)} className={sequence.includes(id)?'lit':''}><span>{sequence.includes(id)?<Check size={14}/>:<Gem size={14}/>}</span>{name}<small>前往</small></button>)}</div>{sequence.length===3&&<button className="temple-relic-route" onClick={()=>navigateRef.current(3)}><Sparkles size={14}/>{props.completed?'重访遗物台':`寻找${theme.artifact}`}<span>→</span></button>}</>}</section>
    <button className="temple-exit" onClick={()=>{if(!props.paused)props.onExit();}}><ArrowLeft size={15}/>返回旷野</button>
    <div className="temple-story" role="status"><Compass size={15}/><span>{message}</span></div>
    {near!==null&&<button className="temple-interact" onClick={()=>interactRef.current()}><kbd>E</kbd>{label}</button>}
    <div className="temple-controls-note">WASD 移动 · 拖动视角 · E 交互 · 点击光印名称自动带路</div>
    <div className="temple-joystick" aria-label="室内移动摇杆" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);moveStick(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))moveStick(e);}} onPointerUp={resetStick} onPointerCancel={resetStick} onLostPointerCapture={resetStick}><span ref={stickRef}/></div>
  </div>;
}
