"use client";

import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import culturesData from '../data/cultures.json';
import careersData from '../data/careers.json';
import stylesData from '../data/combatStyles.json';

// --- THEME ASSETS ---
const parchmentBg = "https://www.transparenttextures.com/patterns/parchment.png";
const watermarkURL = "https://worldofspectrum.org/pub/sinclair/screens/load/p/scr/PanTang.png"; 

// --- TYPES ---
interface Characteristics {
  STR: number; CON: number; SIZ: number; DEX: number; INT: number; POW: number; CHA: number;
}

interface SkillSpend {
  culture: number;
  career: number;
  bonus: number;
}

const standardSkillKeys = [
  "Athletics", "Boating", "Brawn", "Conceal", "Customs", "Dance", 
  "Deceit", "Drive", "Endurance", "Evade", "FirstAid", "Influence", 
  "Insight", "Locale", "NativeTongue", "Perception", "Ride", "Sing", 
  "Stealth", "Swim", "Unarmed", "Willpower"
];

const getProfSkillBase = (skillName: string, chars: Characteristics) => {
  const name = skillName.toLowerCase();
  if (name.includes('art')) return chars.POW + chars.CHA;
  if (name.includes('commerce') || name.includes('courtesy') || name.includes('language')) return chars.INT + chars.CHA;
  if (name.includes('craft')) return chars.DEX + chars.INT;
  if (name.includes('streetwise') || name.includes('binding')) return chars.POW + chars.CHA;
  if (name.includes('lore') || name.includes('locale')) return chars.INT * 2;
  if (name.includes('navigation') || name.includes('healing')) return chars.INT + chars.POW;
  if (name.includes('survival') || name.includes('track')) return chars.CON + chars.POW;
  if (name.includes('trance')) return chars.POW * 2;
  return chars.INT * 2; 
};

const backgroundEvents = [
  "Survived a pirate raid on a merchant cog.",
  "Witnessed a summoning that went horribly wrong.",
  "Exiled from home due to a forbidden romance.",
  "Recovered a minor relic of a forgotten Sorcerer-King.",
  "Debt-bound to a Pan Tangian merchant prince.",
  "Family vanished during a chaotic storm at sea.",
  "Served as a galley slave in the southern ports.",
  "Spared by a Myyrrhn hunter for reasons unknown.",
  "Found an ancient coin from the time of the Dharzi."
];

export default function CharacterBuilder() {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- STATE ---
  const [name, setName] = useState("");
  const [race, setRace] = useState("Human");
  const [alignment, setAlignment] = useState("Neutral");
  const [age, setAge] = useState(18);
  const [background, setBackground] = useState("Roll for a Background Event...");
  
  const [characteristics, setCharacteristics] = useState<Characteristics>({ STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedCareer, setSelectedCareer] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [socialClass, setSocialClass] = useState({ name: "Freeman", multi: 1 });
  const [passions, setPassions] = useState([{ id: 1, target: "Melniboné", val: 0 }]);
  const [dedicatedMPs, setDedicatedMPs] = useState(0);
  const [pactName, setPactName] = useState("");
  const [skillSpends, setSkillSpends] = useState<Record<string, SkillSpend>>({});

  // --- DERIVED DATA & MATH ---
  const activeCulture = (culturesData as any[]).find(c => c.id === selectedCulture);
  const activeCareer = (careersData as any[]).find(c => c.id === selectedCareer);
  const activeStyle = (stylesData as any[]).find(s => s.id === selectedStyle);

  const cultureProfs: string[] = activeCulture?.professionalSkills || [];
  const careerProfs: string[] = activeCareer?.professionalSkills || [];
  const careerStandards: string[] = activeCareer?.standardSkills || [];
  const availableProfSkills = [...new Set([...cultureProfs, ...careerProfs])].sort();

  const charPoints = Object.values(characteristics).reduce((a, b) => a + b, 0);
  const cultureSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.culture || 0), 0);
  const careerSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.career || 0), 0);
  const bonusSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.bonus || 0), 0);

  // Mythras Derived Combat Stats
  const hpBase = Math.ceil((characteristics.CON + characteristics.SIZ) / 5);
  const actionPoints = characteristics.DEX + characteristics.INT <= 24 ? 2 : 3;
  const initiative = Math.ceil((characteristics.DEX + characteristics.INT) / 2);
  
  const strSiz = characteristics.STR + characteristics.SIZ;
  let damageMod = "+0";
  if (strSiz <= 5) damageMod = "-1d8";
  else if (strSiz <= 10) damageMod = "-1d6";
  else if (strSiz <= 15) damageMod = "-1d4";
  else if (strSiz <= 20) damageMod = "-1d2";
  else if (strSiz <= 25) damageMod = "+0";
  else if (strSiz <= 30) damageMod = "+1d2";
  else if (strSiz <= 35) damageMod = "+1d4";
  else if (strSiz <= 40) damageMod = "+1d6";
  else if (strSiz <= 45) damageMod = "+1d8";
  else if (strSiz <= 50) damageMod = "+1d10";
  else if (strSiz <= 60) damageMod = "+1d12";

  let healingRate = 1;
  if (characteristics.CON >= 6 && characteristics.CON <= 10) healingRate = 2;
  else if (characteristics.CON >= 11 && characteristics.CON <= 15) healingRate = 3;
  else if (characteristics.CON >= 16) healingRate = Math.ceil(characteristics.CON / 5);

  let luck = 1;
  if (characteristics.POW >= 7 && characteristics.POW <= 12) luck = 2;
  else if (characteristics.POW >= 13 && characteristics.POW <= 18) luck = 3;
  else if (characteristics.POW >= 19) luck = Math.ceil(characteristics.POW / 6);

  const movement = race === "Myyrrhn" ? "6m (12m Fly)" : "6m";

  // Skill Calculations
  const getStandardBase = (s: string) => {
    const c = characteristics;
    let base = 0;
    if (s === "Customs" || s === "NativeTongue") base = (c.INT * 2) + (selectedCulture ? 40 : 0);
    else if (["Athletics", "Unarmed"].includes(s)) base = c.STR + c.DEX;
    else if (["Boating", "Swim"].includes(s)) base = c.STR + c.CON;
    else if (s === "Brawn") base = c.STR + c.SIZ;
    else if (["Conceal", "Drive", "Ride"].includes(s)) base = c.DEX + c.POW;
    else if (["Dance", "Deceit"].includes(s)) base = c.INT + c.CHA;
    else if (s === "Endurance") base = c.CON * 2;
    else if (s === "Evade") base = c.DEX * 2;
    else if (s === "FirstAid") base = c.INT + c.DEX;
    else if (s === "Influence") base = c.CHA * 2;
    else if (["Insight", "Perception"].includes(s)) base = c.INT + c.POW;
    else if (s === "Locale") base = c.INT * 2;
    else if (s === "Sing") base = c.CHA + c.POW;
    else if (s === "Stealth") base = c.DEX + c.INT;
    else if (s === "Willpower") base = c.POW * 2;
    return base;
  };

  const highSpeechTotal = (characteristics.INT + characteristics.CHA) + 
    (skillSpends["Language (High Speech)"]?.culture || 0) + 
    (skillSpends["Language (High Speech)"]?.career || 0) + 
    (skillSpends["Language (High Speech)"]?.bonus || 0);

  const handleSkillChange = (skill: string, pool: keyof SkillSpend, value: number) => {
    setSkillSpends(prev => ({
      ...prev,
      [skill]: { ...(prev[skill] || { culture: 0, career: 0, bonus: 0 }), [pool]: value }
    }));
  };

  // --- PDF EXPORT LOGIC ---
  const handleExportPDF = () => {
    if (!sheetRef.current) return;
    setIsExporting(true);
    
    setTimeout(async () => {
      try {
        if (!sheetRef.current) return;
        
        const scrollableElements = sheetRef.current.querySelectorAll('.overflow-y-auto');
        scrollableElements.forEach(el => {
          (el as HTMLElement).style.maxHeight = 'none';
          (el as HTMLElement).style.overflow = 'visible';
        });

        const canvas = await html2canvas(sheetRef.current, { 
          scale: 2, 
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${name || 'Elric_Character'}_Sheet.pdf`);

        scrollableElements.forEach(el => {
          (el as HTMLElement).style.maxHeight = '';
          (el as HTMLElement).style.overflow = '';
        });

      } catch (error) {
        console.error("Failed to export PDF", error);
        alert("There was an error generating the PDF.");
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  const SkillRow = ({ name, base, type }: { name: string, base: number, type: string }) => {
    const s = skillSpends[name] || { culture: 0, career: 0, bonus: 0 };
    const total = base + s.culture + s.career + s.bonus;
    const isMagic = ["Summoning Ritual", "Command", "Rune Casting"].includes(name);
    const overCap = isMagic && total > highSpeechTotal;

    const canCulture = type === "standard" || cultureProfs.includes(name) || type === "style";
    const canCareer = careerStandards.includes(name) || careerProfs.includes(name) || type === "style";

    return (
      <tr className="border-b text-[10px]" style={{ borderColor: '#d1d5db', backgroundColor: overCap ? '#fee2e2' : 'transparent' }}>
        <td className="p-1 font-bold" style={{ color: overCap ? '#dc2626' : '#000000' }}>{name}</td>
        <td className="text-center" style={{ color: '#6b7280' }}>{base}</td>
        <td className="text-center border-l" style={{ backgroundColor: '#eff6ff', borderColor: '#e5e7eb' }}>
            <input type="number" step={5} className="w-8 text-center bg-transparent focus:outline-none" disabled={!canCulture} value={s.culture} onChange={e => handleSkillChange(name, 'culture', parseInt(e.target.value) || 0)} style={{ color: '#000000' }} />
        </td>
        <td className="text-center border-l" style={{ backgroundColor: '#f0fdf4', borderColor: '#e5e7eb' }}>
            <input type="number" step={5} className="w-8 text-center bg-transparent focus:outline-none" disabled={!canCareer} value={s.career} onChange={e => handleSkillChange(name, 'career', parseInt(e.target.value) || 0)} style={{ color: '#000000' }} />
        </td>
        <td className="text-center border-l" style={{ backgroundColor: '#faf5ff', borderColor: '#e5e7eb' }}>
            <input type="number" step={5} className="w-8 text-center bg-transparent focus:outline-none" value={s.bonus} onChange={e => handleSkillChange(name, 'bonus', parseInt(e.target.value) || 0)} style={{ color: '#000000' }} />
        </td>
        <td className="text-center font-bold border-l" style={{ borderColor: '#e5e7eb', color: '#000000' }}>{total}%</td>
      </tr>
    );
  };

  return (
    <main 
      className="min-h-screen p-4 font-serif"
      style={{ backgroundColor: "#ece0c8", backgroundImage: `url(${parchmentBg})`, color: '#000000' }}
    >
      <div className="max-w-7xl mx-auto flex justify-end mb-2">
        <button 
          onClick={handleExportPDF} 
          disabled={isExporting}
          className="px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 shadow-md border-2 border-transparent"
          style={{ backgroundColor: '#000000', color: '#ffffff' }}
        >
          {isExporting ? 'Scribing PDF...' : 'Download PDF Sheet'}
        </button>
      </div>

      {/* PDF SHEET CONTAINER - NO TAILWIND COLORS ALLOWED INSIDE HERE */}
      <div id="pdf-sheet-container" ref={sheetRef} className="max-w-7xl mx-auto border-4 p-6 relative overflow-hidden" style={{ borderColor: '#000000', backgroundColor: '#ffffff', boxShadow: isExporting ? 'none' : '0 0 50px rgba(0,0,0,0.2)' }}>
        
        {!isExporting && (
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none grayscale"
            style={{ backgroundImage: `url(${watermarkURL})`, backgroundSize: '50%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
          />
        )}

        <header className="border-b-4 mb-6 pb-2 flex justify-between items-end relative z-10" style={{ borderColor: '#000000' }}>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic drop-shadow-sm" style={{ color: '#000000' }}>Elric: Mythras</h1>
          <div className="text-right text-[10px] font-bold uppercase tracking-widest" style={{ color: '#7f1d1d' }}>
            Young Kingdoms System v1.3
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
          
          <section className="space-y-4">
            <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#ffffff' }}>
              <h2 className="font-bold border-b mb-2 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#7f1d1d' }}>Step 1 & 5: Identity</h2>
              <input placeholder="Character Name" className="w-full text-xs border p-1 mb-1" value={name} onChange={e => setName(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }} />
              <div className="grid grid-cols-2 gap-1">
                <select className="text-xs border p-1" value={race} onChange={e => setRace(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }}>
                    <option>Human</option><option>Melnibonéan</option><option>Myyrrhn</option>
                </select>
                <div className="flex items-center gap-1 border p-1" style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff' }}>
                  <span className="text-[9px] font-bold" style={{ opacity: 0.5, color: '#000000' }}>AGE:</span>
                  <input type="number" className="text-xs w-full bg-transparent outline-none font-bold" value={age} onChange={e => setAge(parseInt(e.target.value) || 18)} style={{ color: '#000000' }} />
                </div>
              </div>
            </div>

            <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#fffbeb' }}>
              <h2 className="font-bold border-b mb-1 uppercase text-[10px] flex justify-between font-black" style={{ borderColor: '#000000', color: '#000000' }}>
                Step 2: Background {!isExporting && <button onClick={() => setBackground(backgroundEvents[Math.floor(Math.random()*backgroundEvents.length)])} className="px-1 text-[8px]" style={{ backgroundColor: '#000000', color: '#ffffff' }}>Roll</button>}
              </h2>
              <p className="text-[10px] italic leading-tight min-h-[45px] flex items-center" style={{ color: '#000000' }}>{background}</p>
            </div>

            <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#eff6ff' }}>
              <h2 className="font-bold border-b mb-2 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#1e3a8a' }}>Step 6: Homeland</h2>
              <select className="w-full text-xs border p-1" value={selectedCulture} onChange={e => setSelectedCulture(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }}>
                <option value="">Choose Kingdom...</option>
                {(culturesData as any[]).map(c => <option key={c.id} value={c.id}>{c.kingdom}</option>)}
              </select>
              {activeCulture && <p className="text-[9px] mt-1 leading-tight italic" style={{ opacity: 0.7, color: '#000000' }}>{activeCulture.description}</p>}
            </div>
            
            <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#f0fdf4' }}>
              <h2 className="font-bold border-b mb-2 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#14532d' }}>Step 7: Career</h2>
              <select className="w-full text-xs border p-1" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }}>
                <option value="">Choose Career...</option>
                {(careersData as any[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </section>

          <section className="space-y-4">
            <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#ffffff' }}>
              <h2 className="font-bold border-b mb-2 uppercase text-[10px] flex justify-between font-black" style={{ borderColor: '#000000', color: '#000000' }}>
                Step 3: Stats <span className="font-black" style={{ color: charPoints > 80 ? '#dc2626' : '#9ca3af' }}>{charPoints}/80</span>
              </h2>
              <div className="grid grid-cols-2 gap-x-4">
                {(Object.keys(characteristics) as (keyof Characteristics)[]).map(k => (
                  <div key={k} className="flex justify-between items-center text-xs mb-1 border-b" style={{ borderColor: '#e5e7eb' }}>
                    <span className="font-bold" style={{ opacity: 0.7, color: '#000000' }}>{k}</span>
                    <input type="number" className="w-8 border-none text-center bg-transparent font-black" value={characteristics[k]} onChange={e => setCharacteristics({...characteristics, [k]: parseInt(e.target.value) || 0})} style={{ color: '#000000' }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#f5f5f4' }}>
              <h2 className="font-bold border-b mb-2 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#000000' }}>Step 4: Attributes</h2>
              <div className="text-[10px] space-y-1" style={{ color: '#000000' }}>
                <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Action Points:</span> <strong>{actionPoints}</strong></div>
                <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Damage Modifier:</span> <strong>{damageMod}</strong></div>
                <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Initiative Bonus:</span> <strong>{initiative}</strong></div>
                <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Healing Rate:</span> <strong>{healingRate}</strong></div>
                <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Luck Points:</span> <strong>{luck}</strong></div>
                <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Movement:</span> <strong>{movement}</strong></div>
                <div className="flex justify-between border-b font-black" style={{ borderColor: '#f3f4f6', color: '#1e3a8a' }}><span>Tenacity (POW):</span> <strong>{characteristics.POW}</strong></div>
                <div className="flex justify-between"><span>Magic Points:</span> <strong>{characteristics.POW - dedicatedMPs}</strong></div>
              </div>
            </div>

            <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#fef2f2' }}>
              <h2 className="font-bold border-b mb-2 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#7f1d1d' }}>Hit Locations</h2>
              <table className="w-full text-center text-[9px] uppercase tracking-wider">
                <thead className="border-b" style={{ borderColor: '#9ca3af', color: '#4b5563' }}><tr><th>D20</th><th className="text-left">Location</th><th>HP</th></tr></thead>
                <tbody style={{ color: '#000000' }}>
                  <tr className="border-b" style={{ borderColor: '#d1d5db' }}><td>1-3</td><td className="text-left font-bold">Right Leg</td><td className="font-black">{hpBase}</td></tr>
                  <tr className="border-b" style={{ borderColor: '#d1d5db' }}><td>4-6</td><td className="text-left font-bold">Left Leg</td><td className="font-black">{hpBase}</td></tr>
                  <tr className="border-b" style={{ borderColor: '#d1d5db' }}><td>7-9</td><td className="text-left font-bold">Abdomen</td><td className="font-black">{hpBase + 1}</td></tr>
                  <tr className="border-b" style={{ borderColor: '#d1d5db' }}><td>10-12</td><td className="text-left font-bold">Chest</td><td className="font-black">{hpBase + 2}</td></tr>
                  <tr className="border-b" style={{ borderColor: '#d1d5db' }}><td>13-15</td><td className="text-left font-bold">Right Arm</td><td className="font-black">{Math.max(1, hpBase - 1)}</td></tr>
                  <tr className="border-b" style={{ borderColor: '#d1d5db' }}><td>16-18</td><td className="text-left font-bold">Left Arm</td><td className="font-black">{Math.max(1, hpBase - 1)}</td></tr>
                  <tr><td>19-20</td><td className="text-left font-bold">Head</td><td className="font-black">{hpBase}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#faf5ff' }}>
              <h2 className="font-bold border-b mb-2 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#581c87' }}>Step 10: Passions</h2>
              {passions.map((p, idx) => (
                <div key={p.id} className="flex gap-1 mb-1 items-center">
                  <input className="text-[10px] border flex-1 p-1" placeholder="Love / Hate..." value={p.target} 
                    onChange={e => { const n = [...passions]; n[idx].target = e.target.value; setPassions(n); }} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }} />
                  <span className="text-[10px] font-black p-1 border min-w-[35px] text-center" style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }}>{characteristics.POW + characteristics.CHA}%</span>
                  {!isExporting && <button onClick={() => setPassions(passions.filter(x => x.id !== p.id))} className="font-bold text-xs" style={{ color: '#dc2626' }}>×</button>}
                </div>
              ))}
              {!isExporting && <button onClick={() => setPassions([...passions, {id: Date.now(), target: "", val: 0}])} className="text-[8px] w-full py-1 mt-1 uppercase" style={{ backgroundColor: '#000000', color: '#ffffff' }}>+ Add Passion</button>}
            </div>
          </section>

          <section className="md:col-span-2 border-2 flex flex-col" style={{ borderColor: '#000000', backgroundColor: '#ffffff' }}>
            <div className="p-1 flex justify-around text-[9px] font-bold uppercase tracking-tighter" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
              <div className="underline underline-offset-2" style={{ color: cultureSpent > 100 ? '#f87171' : '#ffffff' }}>Cult: {cultureSpent}/100</div>
              <div className="underline underline-offset-2" style={{ color: careerSpent > 100 ? '#f87171' : '#ffffff' }}>Car: {careerSpent}/100</div>
              <div className="underline underline-offset-2" style={{ color: bonusSpent > 150 ? '#f87171' : '#ffffff' }}>Bonus: {bonusSpent}/150</div>
            </div>
            <div className="overflow-y-auto max-h-[850px] p-2">
              <table className="w-full border-collapse">
                <thead className="text-[9px] uppercase border-b text-left" style={{ borderColor: '#000000', color: '#000000' }}>
                  <tr><th className="p-1">Skill</th><th>Base</th><th className="text-center" style={{ backgroundColor: '#eff6ff' }}>C</th><th className="text-center" style={{ backgroundColor: '#f0fdf4' }}>J</th><th className="text-center" style={{ backgroundColor: '#faf5ff' }}>B</th><th className="text-center font-black">Total</th></tr>
                </thead>
                <tbody>
                  {standardSkillKeys.map(k => <SkillRow key={k} name={k} base={getStandardBase(k)} type="standard" />)}
                  <tr className="text-[9px] font-bold text-center uppercase tracking-widest" style={{ backgroundColor: '#f3f4f6', color: '#000000' }}><td colSpan={6} className="py-1">Professional Skills</td></tr>
                  {availableProfSkills.map(k => <SkillRow key={k} name={k} base={getProfSkillBase(k, characteristics)} type="prof" />)}
                </tbody>
              </table>
            </div>
            <div className="p-1 border-t text-[8px] italic text-center uppercase tracking-widest font-bold mt-auto" style={{ borderColor: '#000000', backgroundColor: '#7f1d1d', color: '#ffffff' }}>
              Sorcery Cap: Magic skills cannot exceed High Speech ({highSpeechTotal}%).
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}