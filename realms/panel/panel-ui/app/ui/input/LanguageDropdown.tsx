// import { type ChangeEventHandler, type FunctionComponent, useCallback } from "react";
// import {
//   i18nSupportedLanguages,
//   SupportedLanguage,
// } from "@/localization/I18nProvider";
// import { useStoreDispatch, useStoreSelector } from "@/ui/store/ReduxProvider";
// import { getSettings } from "@/ui/store/settings/reducer";
// import { getAuthentication } from "@/ui/store/authentication/reducer";
// import { SettingsLanguageAction } from "@/ui/store/settings/actions";

// const languageText: Record<SupportedLanguage, string> = {
//   en: "English",
//   es: "Español",
// };

// export const LanguageDropdown: FunctionComponent = () => {
//   const { language } = useStoreSelector(getSettings);
//   const { ready } = useStoreSelector(getAuthentication);
//   const dispatch = useStoreDispatch();

//   const languageOnChange: ChangeEventHandler<HTMLSelectElement> = useCallback(
//     ({ target }) => {
//       dispatch(SettingsLanguageAction(target.value as SupportedLanguage));
//     },
//     [dispatch],
//   );

//   if (ready === null) {
//     return null;
//   }

//   return (
//     <>
//       <div className="flex items-center">
//         <div className={"h-6 w-6"}>
//           <svg
//             xmlns="http://www.w3.org/2000/svg"
//             fill="none"
//             viewBox="0 0 24 24"
//             strokeWidth={1.5}
//             stroke="currentColor"
//             className="h-6 w-6"
//           >
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
//             />
//           </svg>
//         </div>
//         <select
//           className={"ml-2 w-full bg-transparent"}
//           onChange={languageOnChange}
//           defaultValue={language}
//         >
//           {i18nSupportedLanguages.map((language) => {
//             return (
//               <option
//                 key={language}
//                 value={language}
//               >
//                 {languageText[language]}
//               </option>
//             );
//           })}
//         </select>
//       </div>
//     </>
//   );
// };
