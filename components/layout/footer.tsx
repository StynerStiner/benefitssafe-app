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
