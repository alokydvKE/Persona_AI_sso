export const Logo = ({ size = 24 }: { size?: number }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlSpace="preserve"
      width={size || "800px"}
      height={size ? (size * 17) / 16 : "800px"}
      // style={{enableBackground:"new 0 0 140 144"}}
      viewBox="0 0 140 144"
    >
      <linearGradient
        id="a"
        x1="-101.465"
        x2="-101.465"
        y1="486.245"
        y2="484.197"
        gradientTransform="matrix(31.856 0 0 -31.879 3275.878 15534.768)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" style={{ stopColor: "#13d8bd" }} />
        <stop offset="1" style={{ stopColor: "#3c48b7" }} />
      </linearGradient>
      <path
        d="m67.15 59.38-4.57-6.76L49.8 33.78 11.01 60.06l26.41 38.99L53.1 88.42a25.364 25.364 0 0 1-3.26-7.93l-10.21 6.92-16.99-25.1L47.62 45.4l8.37 12.35 4.72 6.96 3.91 5.78-7.26 4.91c.08 2.99.93 5.9 2.47 8.46l16.41-11.12-9.09-13.36z"
        style={{ fill: "url(#a)" }}
      />
      <linearGradient
        id="b"
        x1="-98.983"
        x2="-98.983"
        y1="480.186"
        y2="478.139"
        gradientTransform="matrix(22.1942 0 0 -20.7919 2268.783 10041.73)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" style={{ stopColor: "#fc47fb" }} />
        <stop offset="1" style={{ stopColor: "#872bf9" }} />
      </linearGradient>
      <path
        d="M74.59 92.22c-9.36.01-17.02-7.45-17.26-16.8 0-.15-.01-.31-.01-.46-.01-3.68 1.17-7.27 3.36-10.24l-4.72-6.96c-9.51 10.28-8.89 26.32 1.39 35.83 10.28 9.51 26.32 8.89 35.83-1.39.52-.56 1.02-1.15 1.48-1.76l-9.13-2.13a17.125 17.125 0 0 1-10.94 3.91"
        style={{ fill: "url(#b)" }}
      />
      <linearGradient
        id="c"
        x1="-97.28"
        x2="-97.28"
        y1="476.013"
        y2="473.966"
        gradientTransform="matrix(18.2578 0 0 -16.3532 1857.389 7833.944)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" style={{ stopColor: "#fc47fb" }} />
        <stop offset="1" style={{ stopColor: "#872bf9" }} />
      </linearGradient>
      <path
        d="M97.97 65.12C92.53 52.21 77.65 46.15 64.74 51.6c-.74.31-1.46.66-2.16 1.03l4.57 6.76c8.6-4.11 18.91-.48 23.03 8.13a17.28 17.28 0 0 1 .51 13.72l7.94 1.84a25.466 25.466 0 0 0-.64-17.97"
        style={{ fill: "url(#c)" }}
      />
      <linearGradient
        id="d"
        x1="-100.132"
        x2="-100.132"
        y1="485.103"
        y2="483.055"
        gradientTransform="matrix(29.272 0 0 -28.925 3029.724 14070.713)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" style={{ stopColor: "#ffd33d" }} />
        <stop offset="1" style={{ stopColor: "#fd6446" }} />
      </linearGradient>
      <path
        d="m110.85 39.11-17.49 18.8c1.93 2.13 3.49 4.56 4.61 7.21l9.18-9.87 9.63 32.06-18.17-4.22-7.94-1.84-6.34-1.47 7.26-7.8c-.52-2.99-1.82-5.78-3.78-8.11l-19.1 20.54 16.82 3.91 9.14 2.12 33.97 7.89-17.79-59.22z"
        style={{ fill: "url(#d)" }}
      />
    </svg>
  );
};