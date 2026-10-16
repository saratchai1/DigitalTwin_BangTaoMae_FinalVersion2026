import dwrLogo from "../assets/partners/dwr.webp";
import khaotorLogo from "../assets/partners/khaotor.webp";
import cnexLogo from "../assets/partners/cnex.webp";
import "./ProjectPartners.css";

const PARTNERS = [
  {
    id: "dwr",
    name: "กรมทรัพยากรน้ำ",
    english: "Department of Water Resources",
    logo: dwrLogo,
    className: "dwr",
  },
  {
    id: "khaotor",
    name: "องค์การบริหารส่วนตำบลเขาต่อ",
    english: "อบต. เขาต่อ",
    logo: khaotorLogo,
    className: "khaotor",
  },
  {
    id: "cnex",
    name: "CNEX Consortium",
    english: "Project Consortium",
    logo: cnexLogo,
    className: "cnex",
  },
] as const;

export function ProjectPartners() {
  return (
    <section className="cc2-project-partners" aria-label="หน่วยงานและพันธมิตรโครงการ">
      <header className="cc2-project-partners-head">
        <div>
          <p>PROJECT PARTNERS</p>
          <h2>หน่วยงานและพันธมิตรโครงการ</h2>
          <span>Bang Tao Mae Digital Twin · Command Center</span>
        </div>
        <div className="cc2-project-partners-chip">PUBLIC · LOCAL · CONSORTIUM</div>
      </header>

      <div className="cc2-project-partners-grid">
        {PARTNERS.map((partner) => (
          <article className={`cc2-project-partner ${partner.className}`} key={partner.id}>
            <div className="cc2-project-partner-logo">
              <img src={partner.logo} alt={`โลโก้ ${partner.name}`} />
            </div>
            <div className="cc2-project-partner-copy">
              <strong>{partner.name}</strong>
              <span>{partner.english}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
