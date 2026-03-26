# HLC BIM Platform

A web-based platform for heat load analysis with interactive 3D building modeling, developed as a thesis project.

The platform collects building survey data through an input interface, analyzes it using a heat load engine, and reflects the results in a 3D building model in real time — combining engineering analysis and visualization in one place.

Currently the project has the initial Next.js setup and folder structure in place. Implementation will be built out incrementally.

## Project Structure

```text
hlc-bim-platform/
├── public/
│   ├── textures/
│   ├── models/
│   └── icons/
│
├── src/
│   ├── app/
│   ├── components/
│   │   ├── layout/
│   │   ├── survey/
│   │   ├── calculation/
│   │   ├── viewer3d/
│   │   └── common/
│   │
│   ├── features/
│   │   ├── building-survey/
│   │   ├── heat-load/
│   │   ├── bim-model/
│   │   └── materials/
│   │
│   ├── lib/
│   │   ├── calculations/
│   │   ├── geometry/
│   │   ├── converters/
│   │   └── validators/
│   │
│   ├── data/
│   │   ├── materials/
│   │   ├── defaults/
│   │   └── mock/
│   │
│   ├── hooks/
│   ├── store/
│   ├── types/
│   └── utils/
```

## Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
