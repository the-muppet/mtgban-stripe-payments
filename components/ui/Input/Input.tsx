import React, { InputHTMLAttributes, ChangeEvent, useState } from 'react';
import cn from 'classnames';

import s from './Input.module.css';

interface Props extends Omit<InputHTMLAttributes<any>, 'onChange'> {
  className?: string;
  onChange: (value: string) => void;
}

const Input = (props: Props) => {
  const { className, children, onChange, ...rest } = props;
  const [isFocused, setIsFocused] = useState(false);

  const rootClassName = cn(
    s.root,
    {
      [s.focused]: isFocused
    },
    className
  );

  const handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
    return null;
  };

  return (
    <label className={s.wrapper}>
      <input
        className={rootClassName}
        onChange={handleOnChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        {...rest}
      />
      {/* Gradient border effect */}
      <div className={cn(s.borderGlow, { [s.borderGlowActive]: isFocused })} />
    </label>
  );
};

export default Input;