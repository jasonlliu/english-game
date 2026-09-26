import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { createPet, type ModelRig, type PetId } from './adventureModels';

const portraits = new Map<string, string>();
export default function CompanionPortrait({ stage = 1, petId = 'ember' }: { stage?: number; petId?: PetId }) {
  const safeStage = Math.max(0, Math.min(3, Math.floor(stage))) as 0 | 1 | 2 | 3;
  const key = `${petId}-${safeStage}`;
  const [source, setSource] = useState(portraits.get(key) || '');
  useEffect(() => {
    if (portraits.has(key)) { setSource(portraits.get(key)!); return; }
    let renderer: THREE.WebGLRenderer | undefined;
    let model: ModelRig | undefined;
    try {
      renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
      renderer.setSize(320,320); renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#fff8e2','#8cafa0',2.4));
      const light = new THREE.DirectionalLight('#fff0cc',3.5);light.position.set(-3,5,-4);scene.add(light);
      const rim = new THREE.DirectionalLight('#9be4d5',2);rim.position.set(3,3,3);scene.add(rim);
      model = createPet(petId, safeStage);scene.add(model.group);
      model.animate(0,0,0);
      const bounds = new THREE.Box3().setFromObject(model.group);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const camera = new THREE.PerspectiveCamera(29,1,.1,100);
      const distance = Math.max(size.x,size.y,size.z*.8)*(petId==='ember'&&safeStage===3?1.95:2.4);
      if(petId!=='ember') camera.position.set(center.x+distance*.42,center.y+distance*.32,center.z-distance*.95);
      else if(safeStage>=2) camera.position.set(center.x+distance*.7,center.y+distance*.5,center.z-distance*.72);
      else camera.position.set(center.x+distance*.35,center.y+distance*.22,center.z-distance);
      camera.lookAt(center);
      renderer.render(scene,camera);
      const data=renderer.domElement.toDataURL('image/png');portraits.set(key,data);setSource(data);
    } catch { setSource(''); }
    finally { model?.dispose();renderer?.dispose();renderer?.forceContextLoss(); }
  },[petId,safeStage,key]);
  return source ? <img className="companion-portrait" src={source} alt="" draggable={false}/> : <span className="companion-portrait portrait-fallback" aria-hidden="true">✦</span>;
}
