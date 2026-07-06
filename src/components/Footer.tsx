import Link from "next/link";
import BrandLogo from "./BrandLogo";

const FOOTER_LINKS = ["Despre noi", "Contact", "Confidențialitate", "Termeni"];

export default function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <BrandLogo gradientId="pg-footer" />
        <div className="footer-links">
          {FOOTER_LINKS.map((label) => (
            <Link key={label} href="/">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
