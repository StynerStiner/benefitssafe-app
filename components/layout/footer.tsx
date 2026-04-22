import Link from "next/link";

const Footer = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  return (
    <footer className="d-footer bg-white dark:bg-[#273142] py-4 sm:py-6 px-4 sm:px-[22px] mt-[auto] min-h-[64px] sm:min-h-[80px]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 flex-wrap text-sm sm:text-base">
        <p className="mb-0 text-neutral-600 dark:text-white break-words">
          &copy; {currentYear} BenefitsSafe. All Rights Reserved.
        </p>
        <nav aria-label="Legal" className="mb-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-600 dark:text-white">
          <Link
            href="https://benefitssafe.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary dark:hover:text-primary"
          >
            Privacy
          </Link>
          <Link
            href="https://benefitssafe.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary dark:hover:text-primary"
          >
            Terms
          </Link>
          <Link
            href="https://benefitssafe.com/dpa"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary dark:hover:text-primary"
          >
            DPA
          </Link>
        </nav>
        <p className="mb-0 dark:text-white">
          Made by{" "}
          <span className="font-medium text-primary dark:text-primary">
            BenefitsSafe
          </span>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
