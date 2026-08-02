import Image from "next/image";

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  withGradient?: boolean;
};

const sizeMap = {
  sm: { container: "h-8 w-8", image: 32 },
  md: { container: "h-11 w-11", image: 44 },
  lg: { container: "h-16 w-16", image: 64 },
  xl: { container: "h-20 w-20", image: 80 },
};

export default function Logo({ size = "md", className = "", withGradient = false }: LogoProps) {
  const { container, image } = sizeMap[size];

  if (withGradient) {
    return (
      <div
        className={`flex ${container} shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] shadow-lg shadow-orange-500/30 overflow-hidden ${className}`}
      >
        <Image
          src="/img/logoTACH.png"
          alt="TACH Logo"
          width={image}
          height={image}
          className="object-contain p-1"
          priority
        />
      </div>
    );
  }

  return (
    <div className={`flex ${container} shrink-0 items-center justify-center ${className}`}>
      <Image
        src="/img/logoTACH.png"
        alt="TACH Logo"
        width={image}
        height={image}
        className="object-contain"
        priority
      />
    </div>
  );
}
