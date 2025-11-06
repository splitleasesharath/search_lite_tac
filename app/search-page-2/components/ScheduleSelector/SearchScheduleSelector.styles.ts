import styled from 'styled-components';
import { motion } from 'framer-motion';

export const Container = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  user-select: none;

  @media (max-width: 768px) {
    padding: 16px;
    border-radius: 12px;
  }
`;

export const SelectorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const CalendarIcon = styled.div`
  font-size: 32px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  flex-shrink: 0;
`;

export const DaysGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);

  @media (max-width: 768px) {
    gap: 6px;
    padding: 6px;
  }
`;

export const DayCell = styled(motion.button)<{
  $isSelected: boolean;
  $isDragging: boolean;
  $hasError?: boolean;
  $errorStyle?: 1 | 2 | 3;
}>`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  border: none;
  border-radius: 12px;
  cursor: ${props => props.$isDragging ? 'grabbing' : 'pointer'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  /* Style 1: Red gradient background */
  ${props => props.$hasError && props.$errorStyle === 1 && props.$isSelected && `
    background: linear-gradient(135deg, #f93a5a 0%, #d32f2f 100%) !important;
    color: #ffffff !important;
    box-shadow: 0 4px 12px rgba(249, 58, 90, 0.4) !important;
    animation: pulse-error 1.5s ease-in-out infinite;

    @keyframes pulse-error {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `}

  /* Style 2: Red border with shake */
  ${props => props.$hasError && props.$errorStyle === 2 && props.$isSelected && `
    border: 2px solid #d32f2f !important;
    background: rgba(255, 255, 255, 0.9) !important;
    color: #d32f2f !important;
    box-shadow: 0 0 0 3px rgba(211, 47, 47, 0.2) !important;
    animation: shake 0.5s ease-in-out;

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
  `}

  /* Style 3: Striped pattern */
  ${props => props.$hasError && props.$errorStyle === 3 && props.$isSelected && `
    background: repeating-linear-gradient(
      45deg,
      #667eea,
      #667eea 10px,
      #d32f2f 10px,
      #d32f2f 20px
    ) !important;
    color: #ffffff !important;
    box-shadow: 0 4px 12px rgba(211, 47, 47, 0.4) !important;
  `}

  /* Normal selected state (no error) */
  ${props => !props.$hasError && `
    background: ${
      props.$isSelected
        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        : 'rgba(255, 255, 255, 0.9)'
    };
    color: ${props.$isSelected ? '#ffffff' : '#333333'};
    box-shadow: ${
      props.$isSelected
        ? '0 4px 12px rgba(102, 126, 234, 0.4)'
        : '0 2px 8px rgba(0, 0, 0, 0.1)'
    };
  `}

  &:hover {
    box-shadow: ${props =>
      props.$isSelected
        ? '0 6px 16px rgba(102, 126, 234, 0.6)'
        : '0 4px 12px rgba(0, 0, 0, 0.15)'
    };
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.6);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
    font-size: 14px;
    border-radius: 10px;
  }

  @media (max-width: 480px) {
    width: 36px;
    height: 36px;
    font-size: 12px;
  }
`;

export const InfoContainer = styled.div`
  min-height: 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
`;

export const InfoText = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.95);
  text-align: center;

  @media (max-width: 768px) {
    font-size: 13px;
  }
`;

export const ResetButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  text-decoration: underline;
  cursor: pointer;
  padding: 4px 8px;
  transition: all 0.2s ease;

  &:hover {
    color: #ffffff;
    text-decoration: none;
  }

  &:active {
    transform: scale(0.98);
  }
`;

export const ErrorPopup = styled(motion.div)`
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 280px;

  @media (max-width: 768px) {
    min-width: 240px;
    padding: 12px 20px;
  }
`;

export const ErrorIcon = styled.span`
  font-size: 24px;
  flex-shrink: 0;
`;

export const ErrorMessage = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #d32f2f;
  line-height: 1.4;
`;
