// import {
//   ChangeEventHandler,
//   FunctionComponent,
//   MouseEventHandler,
//   useCallback,
//   useContext,
//   useEffect,
// } from "react";
// import { Direction, Range } from "react-range";
// import { useStoreDispatch, useStoreSelector } from "@/ui/store/ReduxProvider";
// import { getSettings } from "@/ui/store/settings/reducer";
// import {
//   SettingsGameSpeedAction,
//   SettingsNumberHintAction,
//   SettingsPauseBetweenRoundsAction,
// } from "@/ui/store/settings/actions";
// import { HeaderSettingsOpenContext } from "./$HeaderLayout";

// interface HeaderSettingsElementProps<T, H> {
//   value: T;
//   labelI18nId: string;
//   onChange: H;
// }
// const HeaderSettingsBooleanToggle: FunctionComponent<
//   HeaderSettingsElementProps<boolean, ChangeEventHandler>
// > = ({ value, onChange, labelI18nId }) => {
//   return (
//     <label
//       className="mb-4 flex items-center gap-2 accent-emerald-300 last:mb-0"
//       onClick={onChange as unknown as MouseEventHandler}
//     >
//       <input
//         key={`${labelI18nId}_${value?.toString()}`}
//         type={"checkbox"}
//         checked={value}
//         onChange={onChange}
//         suppressHydrationWarning
//       />
//       <FormattedMessage id={labelI18nId} />
//     </label>
//   );
// };

// const HeaderSettingsNumberSlider: FunctionComponent<
//   HeaderSettingsElementProps<number, (v: number) => void> & {
//     inputProps: Partial<typeof Range.defaultProps>;
//   }
// > = ({ labelI18nId, value, onChange, inputProps }) => {
//   return (
//     <label className="mb-2 last:mb-0">
//       <div className="mb-1 text-left">
//         <FormattedMessage id={labelI18nId} />
//       </div>
//       <Range
//         {...inputProps}
//         labelledBy="speed"
//         direction={Direction.Left}
//         values={[value]}
//         onChange={([value]) => {
//           onChange(value);
//         }}
//         renderTrack={({ props, children }) => (
//           <div
//             {...props}
//             key={"track"}
//             style={{
//               ...props.style,
//               height: "0.40em",
//               borderRadius: "1em",
//             }}
//             className={"bg-zinc-500"}
//           >
//             {children}
//           </div>
//         )}
//         renderThumb={({ props }) => (
//           <div
//             {...props}
//             key={"track"}
//             style={{
//               ...props.style,
//               padding: "0.25em",
//               borderRadius: "1em",
//             }}
//           >
//             <div
//               style={{
//                 height: "1em",
//                 width: "1em",
//                 borderRadius: "1em",
//               }}
//               className={"bg-emerald-300"}
//             />
//           </div>
//         )}
//       />
//     </label>
//   );
// };
// export const HeaderSettingsModal: FunctionComponent = () => {
//   const { showNumberOverlay, pauseBetweenRounds, gameSpeed } =
//     useStoreSelector(getSettings);
//   const [settingsOpen, setSettingsOpen] = useContext(HeaderSettingsOpenContext);
//   const dispatch = useStoreDispatch();

//   const preventDefault: MouseEventHandler<HTMLElement> = useCallback(
//     (event) => {
//       event.preventDefault();
//       event.stopPropagation();
//     },
//     [],
//   );

//   const showNumberOnChange: ChangeEventHandler = useCallback(() => {
//     dispatch(SettingsNumberHintAction(!showNumberOverlay));
//   }, [dispatch, showNumberOverlay]);

//   const pauseBetweenRoundsOnChange: ChangeEventHandler = useCallback(() => {
//     dispatch(SettingsPauseBetweenRoundsAction(!pauseBetweenRounds));
//   }, [dispatch, pauseBetweenRounds]);

//   const gameSpeedOnChange: (value: number) => void = useCallback(
//     (value) => {
//       dispatch(SettingsGameSpeedAction(value));
//     },
//     [dispatch],
//   );

//   useEffect(() => {
//     const handler = (event: KeyboardEvent) => {
//       if (event.key.toLowerCase() === "escape") {
//         setSettingsOpen(false);
//       }
//     };

//     if (settingsOpen) {
//       document.addEventListener("keydown", handler);
//     }

//     return () => {
//       document.removeEventListener("keydown", handler);
//     };
//   }, [settingsOpen, setSettingsOpen]);

//   return (
//     <div
//       onClick={preventDefault}
//       className={`absolute left-1 right-1 z-40 mr-0 mt-1 md:left-[unset] md:mt-2 md:min-w-[20em] ${
//         settingsOpen
//           ? "visible translate-x-0 opacity-95"
//           : "invisible translate-x-[110%] opacity-5 md:translate-x-[41vw]"
//       } origin-left transition-[transform,visibility,opacity] duration-200 ease-out will-change-transform`}
//     >
//       <div
//         className="z-30 rounded-xl border bg-zinc-700 p-4"
//         onClick={preventDefault}
//       >
//         <HeaderSettingsBooleanToggle
//           labelI18nId={"menu.settings.numbers.header"}
//           value={showNumberOverlay}
//           onChange={showNumberOnChange}
//         />
//         <HeaderSettingsBooleanToggle
//           labelI18nId={"menu.settings.pause.header"}
//           value={pauseBetweenRounds}
//           onChange={pauseBetweenRoundsOnChange}
//         />
//         <HeaderSettingsNumberSlider
//           labelI18nId={"menu.settings.speed.header"}
//           value={gameSpeed}
//           onChange={gameSpeedOnChange}
//           inputProps={{
//             min: 1000,
//             max: 3000,
//             step: 250,
//           }}
//         />
//       </div>
//     </div>
//   );
// };
